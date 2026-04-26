<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import {
  fetchOrder,
  payOrder,
  fetchOrderPayment,
  cancelOrder,
  uploadPaymentProof,
} from '../services/api'
import type { Order, PromptPayQR } from '../data/types'

const route = useRoute()
const router = useRouter()

const order = ref<Order | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// --- Payment QR state ---
const qr = ref<PromptPayQR | null>(null)
const requesting = ref(false)
const paymentError = ref<string | null>(null)
const cancelling = ref(false)
const showCancelModal = ref(false)
const cancelError = ref<string | null>(null)

// --- Proof upload state ---
const proofFile = ref<File | null>(null)
const proofPreview = ref<string | null>(null)
const proofInputRef = ref<HTMLInputElement | null>(null)
const uploadingProof = ref(false)
const proofError = ref<string | null>(null)

let pollHandle: ReturnType<typeof setInterval> | null = null

const isAwaitingPayment = computed(() => order.value?.status === 'awaiting_payment')
const isPendingVerification = computed(() => order.value?.status === 'pending_verification')
const isRejected = computed(() => order.value?.paymentProof?.status === 'rejected')
const isPaid = computed(() => order.value?.paymentStatus === 'paid')

onMounted(async () => {
  try {
    order.value = await fetchOrder(route.params.id as string)
    if (order.value?.status === 'awaiting_payment') {
      try {
        qr.value = await fetchOrderPayment(order.value.id)
      } catch {
        // No payment configured yet on the merchant side, or QR couldn't be
        // generated — handled inline below.
      }
    }
    if (order.value?.status === 'pending_verification') {
      startPolling()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load order'
  } finally {
    loading.value = false
  }
})

onUnmounted(stopPolling)

function shortId(id: string) {
  return id.slice(-6).toUpperCase()
}

async function generateQR() {
  if (!order.value) return
  requesting.value = true
  paymentError.value = null
  try {
    qr.value = await payOrder(order.value.id)
  } catch (e) {
    paymentError.value = e instanceof Error ? e.message : 'Could not load payment QR. Please try again.'
  } finally {
    requesting.value = false
  }
}

function pickProof() {
  proofInputRef.value?.click()
}

function onProofChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  proofError.value = null
  proofFile.value = file
  if (proofPreview.value) URL.revokeObjectURL(proofPreview.value)
  proofPreview.value = URL.createObjectURL(file)
  input.value = ''
}

function clearProof() {
  if (proofPreview.value) URL.revokeObjectURL(proofPreview.value)
  proofPreview.value = null
  proofFile.value = null
}

async function submitProof() {
  if (!order.value || !proofFile.value) return
  uploadingProof.value = true
  proofError.value = null
  try {
    order.value = await uploadPaymentProof(order.value.id, proofFile.value)
    clearProof()
    qr.value = null
    startPolling()
  } catch (e) {
    proofError.value = e instanceof Error ? e.message : 'Upload failed. Please try again.'
  } finally {
    uploadingProof.value = false
  }
}

function requestCancelOrder() {
  cancelError.value = null
  showCancelModal.value = true
}

function dismissCancelModal() {
  if (cancelling.value) return
  showCancelModal.value = false
  cancelError.value = null
}

async function confirmCancelOrder() {
  if (!order.value) return
  cancelling.value = true
  cancelError.value = null
  try {
    order.value = await cancelOrder(order.value.id)
    qr.value = null
    clearProof()
    stopPolling()
    showCancelModal.value = false
  } catch (e) {
    cancelError.value = e instanceof Error ? e.message : 'Could not cancel order'
  } finally {
    cancelling.value = false
  }
}

function startPolling() {
  stopPolling()
  pollHandle = setInterval(async () => {
    if (!order.value) return
    try {
      const fresh = await fetchOrder(order.value.id)
      const wasPending = order.value.status === 'pending_verification'
      order.value = fresh
      if (fresh.paymentStatus === 'paid' || fresh.status === 'cancelled') {
        stopPolling()
      } else if (wasPending && fresh.status === 'awaiting_payment') {
        // Merchant rejected with "request new proof" — refresh the QR so the
        // customer can retry.
        try {
          qr.value = await fetchOrderPayment(fresh.id)
        } catch {
          // Ignore — user can hit "Generate QR" manually.
        }
      }
    } catch {
      // Swallow transient errors — next tick will retry
    }
  }, 4000)
}

function stopPolling() {
  if (pollHandle) {
    clearInterval(pollHandle)
    pollHandle = null
  }
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  awaiting_payment: { label: 'Awaiting payment', class: 'bg-amber-100 text-amber-700' },
  pending_verification: { label: 'Verifying payment', class: 'bg-blue-100 text-blue-700' },
  pending: { label: 'Pending', class: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmed', class: 'bg-blue-100 text-blue-800' },
  preparing: { label: 'Preparing', class: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'Delivered', class: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', class: 'bg-gray-100 text-gray-600' },
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <!-- Loading -->
    <div v-if="loading" class="max-w-2xl mx-auto px-4 py-20 flex flex-col items-center gap-4">
      <div class="w-24 h-24 rounded-full bg-gray-200 animate-pulse" />
      <div class="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      <div class="h-4 w-64 bg-gray-100 rounded animate-pulse" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="max-w-2xl mx-auto px-4 py-20 text-center">
      <div class="text-5xl mb-3">⚠️</div>
      <p class="font-medium text-gray-700">{{ error }}</p>
      <button @click="router.push('/')" class="mt-6 bg-brand-500 text-white px-6 py-3 rounded-2xl font-semibold">
        Back to home
      </button>
    </div>

    <div v-else-if="order" class="max-w-2xl mx-auto px-4 py-6">
      <div class="flex items-center gap-3 mb-4">
        <button @click="router.push('/orders')" class="text-brand-500 text-sm">← Back to orders</button>
      </div>

      <div class="flex flex-col items-center text-center">
        <!-- Header — varies by state -->
        <template v-if="isAwaitingPayment">
          <template v-if="isRejected">
            <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl mb-5 shadow-inner">⚠️</div>
            <h1 class="text-2xl font-bold text-gray-900 mb-1">Payment wasn't verified</h1>
            <p class="text-gray-500 text-sm mb-1">Please pay again and upload a new screenshot.</p>
          </template>
          <template v-else>
            <div class="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-4xl mb-5 shadow-inner">📱</div>
            <h1 class="text-2xl font-bold text-gray-900 mb-1">Complete your payment</h1>
            <p class="text-gray-500 text-sm mb-1">Scan the QR, pay, then upload your receipt.</p>
          </template>
        </template>
        <template v-else-if="isPendingVerification">
          <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-4xl mb-5 shadow-inner">⏳</div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Verifying payment…</h1>
          <p class="text-gray-500 text-sm mb-1">{{ order.restaurantName }} is reviewing your screenshot.</p>
        </template>
        <template v-else-if="order.status === 'cancelled'">
          <template v-if="isRejected">
            <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl mb-5 shadow-inner">⚠️</div>
            <h1 class="text-2xl font-bold text-gray-900 mb-1">Order cancelled by restaurant</h1>
            <p class="text-gray-500 text-sm mb-1">{{ order.restaurantName }} couldn't verify your payment.</p>
          </template>
          <template v-else>
            <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-4xl mb-5">✖</div>
            <h1 class="text-2xl font-bold text-gray-900 mb-1">Order cancelled</h1>
            <p class="text-gray-500 text-sm mb-1">This order has been cancelled.</p>
          </template>
        </template>
        <template v-else>
          <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mb-5 shadow-inner">✅</div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">{{ isPaid ? 'Order confirmed!' : 'Order placed!' }}</h1>
          <p class="text-gray-500 text-sm mb-1">Your lunch order is on its way.</p>
        </template>

        <p class="text-xs text-gray-400 mb-3 font-mono">Order #{{ shortId(order.id) }}</p>

        <span class="inline-block text-xs font-medium px-3 py-1 rounded-full mb-6" :class="STATUS_BADGE[order.status].class">
          {{ STATUS_BADGE[order.status].label }}
        </span>

        <!-- Order summary card -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full text-left mb-4">
          <p class="text-xs text-gray-400 font-medium mb-1">From</p>
          <p class="font-semibold text-gray-900 mb-4">{{ order.restaurantName }}</p>

          <div class="divide-y divide-gray-100">
            <div
              v-for="item in order.items"
              :key="item.menuItemId"
              class="py-2.5 flex items-center justify-between gap-2"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">{{ item.name }}</p>
                <p v-if="item.note" class="text-xs text-gray-400 mt-0.5">Note: {{ item.note }}</p>
              </div>
              <div class="shrink-0 text-right">
                <span class="text-xs text-gray-400">× {{ item.quantity }}</span>
                <p class="text-sm font-semibold text-gray-900">฿{{ item.price * item.quantity }}</p>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-100 mt-3 pt-3 space-y-1">
            <div class="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>฿{{ order.subtotal }}</span>
            </div>
            <div class="flex justify-between text-sm text-gray-500">
              <span>Delivery</span>
              <span :class="order.deliveryFee === 0 ? 'text-green-600' : ''">
                {{ order.deliveryFee === 0 ? 'Free' : `฿${order.deliveryFee}` }}
              </span>
            </div>
            <div class="flex justify-between font-bold text-gray-900 pt-1">
              <span>Total</span><span>฿{{ order.total }}</span>
            </div>
          </div>
        </div>

        <!-- Rejection notice — shown both when the merchant asked for a new
             proof (status reverted to awaiting_payment) and when they cancelled
             the order outright after rejecting. -->
        <div
          v-if="isRejected && (isAwaitingPayment || order.status === 'cancelled')"
          class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3 mb-4 w-full text-left"
        >
          <p class="font-semibold mb-0.5">
            {{ order.status === 'cancelled' ? 'Payment was rejected' : 'Previous payment was rejected' }}
          </p>
          <p v-if="order.paymentProof?.reviewerNote">
            <span class="text-red-500">Reason from restaurant:</span> "{{ order.paymentProof.reviewerNote }}"
          </p>
          <p v-else-if="order.status === 'cancelled'">
            The restaurant couldn't verify the screenshot you uploaded.
          </p>
          <p v-else>
            The restaurant couldn't verify your previous screenshot. Please pay and upload a fresh one.
          </p>
        </div>

        <div v-if="paymentError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 w-full">
          ⚠️ {{ paymentError }}
        </div>

        <!-- ====== AWAITING PAYMENT ====== -->
        <template v-if="isAwaitingPayment">
          <!-- A: No QR loaded yet (e.g. restaurant has no PromptPay configured) -->
          <div v-if="!qr" class="w-full space-y-3">
            <button
              @click="generateQR"
              :disabled="requesting || cancelling"
              class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-2xl py-4 font-bold text-base shadow-lg active:scale-[0.97] transition-transform"
            >
              {{ requesting ? 'Loading…' : `Pay ฿${order.total} with PromptPay` }}
            </button>
            <button
              @click="requestCancelOrder"
              :disabled="cancelling || requesting"
              class="w-full border border-gray-200 text-gray-600 disabled:opacity-60 rounded-2xl py-3 font-medium text-sm hover:bg-gray-50"
            >
              {{ cancelling ? 'Cancelling…' : 'Cancel order' }}
            </button>
          </div>

          <!-- B: QR active + proof upload -->
          <div v-else class="w-full">
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4 text-center">
              <p class="text-sm font-semibold text-gray-800 mb-1">Scan with any Thai banking app</p>
              <p class="text-xs text-gray-400 mb-4">KBank, SCB, Krungthai, Bangkok Bank, etc.</p>

              <img
                :src="qr.qrImageUrl"
                alt="PromptPay QR Code"
                class="mx-auto w-56 h-56 rounded-xl"
              />

              <p class="mt-4 text-2xl font-bold text-gray-900">฿{{ order.total }}</p>
              <p class="text-xs text-gray-400 mt-1">Pays directly to {{ order.restaurantName }}</p>
            </div>

            <!-- Proof upload card -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 text-left">
              <h2 class="font-semibold text-gray-800 text-sm mb-1">After paying, send your receipt</h2>
              <p class="text-xs text-gray-500 mb-3">
                Take a screenshot from your banking app and upload it here. The restaurant will verify and confirm your order.
              </p>

              <input
                ref="proofInputRef"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                class="hidden"
                @change="onProofChosen"
              />

              <div v-if="proofPreview" class="space-y-3">
                <img :src="proofPreview" class="w-full max-h-72 object-contain rounded-xl border border-gray-200 bg-gray-50" />
                <div v-if="proofError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
                  ⚠️ {{ proofError }}
                </div>
                <div class="flex gap-2">
                  <button
                    @click="clearProof"
                    :disabled="uploadingProof"
                    class="flex-1 border border-gray-200 text-gray-600 disabled:opacity-60 rounded-xl py-2.5 font-medium text-sm hover:bg-gray-50"
                  >
                    Change
                  </button>
                  <button
                    @click="submitProof"
                    :disabled="uploadingProof"
                    class="flex-[2] bg-brand-500 disabled:opacity-60 text-white rounded-xl py-2.5 font-semibold text-sm"
                  >
                    {{ uploadingProof ? 'Uploading…' : 'Send to restaurant' }}
                  </button>
                </div>
              </div>

              <div v-else class="space-y-3">
                <div v-if="proofError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
                  ⚠️ {{ proofError }}
                </div>
                <button
                  @click="pickProof"
                  class="w-full border-2 border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50 transition-colors rounded-xl py-6 text-brand-600 text-sm font-semibold flex flex-col items-center gap-1"
                >
                  <span class="text-2xl">📷</span>
                  <span>I've paid — upload screenshot</span>
                  <span class="text-xs text-gray-400 font-normal">PNG or JPEG, up to 8 MB</span>
                </button>
              </div>
            </div>

            <button
              @click="requestCancelOrder"
              :disabled="cancelling"
              class="w-full border border-red-200 text-red-600 disabled:opacity-60 rounded-2xl py-3 font-medium text-sm hover:bg-red-50"
            >
              {{ cancelling ? 'Cancelling…' : 'Cancel order' }}
            </button>
          </div>
        </template>

        <!-- ====== PENDING VERIFICATION ====== -->
        <template v-else-if="isPendingVerification">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 w-full mb-4 text-center">
            <div class="flex items-center justify-center gap-2 text-sm text-gray-500 mb-3">
              <span class="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              Waiting for {{ order.restaurantName }} to confirm…
            </div>
            <p class="text-xs text-gray-400">
              We've sent your receipt to the restaurant. This page will update automatically once they confirm.
            </p>
          </div>
          <button
            @click="requestCancelOrder"
            :disabled="cancelling"
            class="w-full border border-gray-200 text-gray-600 disabled:opacity-60 rounded-2xl py-3 font-medium text-sm hover:bg-gray-50"
          >
            {{ cancelling ? 'Cancelling…' : 'Cancel order' }}
          </button>
        </template>

        <!-- ====== PAID / OTHER STATES ====== -->
        <template v-else>
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full text-left mb-8">
            <div class="flex items-center gap-3 mb-3">
              <span class="text-2xl">🕐</span>
              <div>
                <p class="text-xs text-gray-400">Estimated delivery</p>
                <p class="font-bold text-gray-900">{{ order.serviceDate ? new Date(order.serviceDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', weekday: 'short', month: 'short', day: 'numeric' }) : '20–30 minutes' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-2xl">📍</span>
              <div>
                <p class="text-xs text-gray-400">Delivering to</p>
                <p class="font-bold text-gray-900">Agoda HQ, Bangkok</p>
              </div>
            </div>
          </div>

          <button
            @click="router.push('/')"
            class="bg-brand-500 text-white px-8 py-3 rounded-2xl font-semibold text-base"
          >
            Order more food
          </button>
        </template>
      </div>
    </div>

    <!-- Cancel-order confirmation modal -->
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showCancelModal"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        @click.self="dismissCancelModal"
      >
        <div
          class="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-xl px-6 pt-6 pb-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-order-title"
        >
          <div class="flex flex-col items-center text-center">
            <div class="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-3xl mb-3">⚠️</div>
            <h2 id="cancel-order-title" class="text-lg font-bold text-gray-900 mb-1">Cancel this order?</h2>
            <p class="text-sm text-gray-500 mb-1">
              Your order from
              <span class="font-medium text-gray-700">{{ order?.restaurantName }}</span>
              will be cancelled.
            </p>
            <p class="text-xs text-gray-400">This cannot be undone.</p>
          </div>

          <div v-if="cancelError" class="mt-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
            ⚠️ {{ cancelError }}
          </div>

          <div class="mt-5 flex flex-col-reverse sm:flex-row gap-2">
            <button
              @click="dismissCancelModal"
              :disabled="cancelling"
              class="flex-1 border border-gray-200 text-gray-700 disabled:opacity-60 rounded-xl py-3 font-medium text-sm hover:bg-gray-50"
            >
              Keep order
            </button>
            <button
              @click="confirmCancelOrder"
              :disabled="cancelling"
              class="flex-1 bg-red-600 disabled:opacity-60 text-white rounded-xl py-3 font-semibold text-sm hover:bg-red-700"
            >
              {{ cancelling ? 'Cancelling…' : 'Yes, cancel order' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
