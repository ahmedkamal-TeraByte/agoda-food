<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import MerchantTabs from '../components/MerchantTabs.vue'
import MerchantOrderCard from '../components/MerchantOrderCard.vue'
import OrderReceipt from '../components/OrderReceipt.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import {
  fetchMerchantOrders,
  updateOrderStatus,
  fetchMerchantPaymentProof,
  confirmMerchantPayment,
  rejectMerchantPayment,
  fetchMerchantRestaurant,
  updateMerchantRestaurant,
} from '../services/api'
import type { Order, PaymentProofView, Restaurant } from '../data/types'

const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const selectedDate = ref('')
let userPickedDate = false

// ---------------------------------------------------------------------------
// "Accepting orders" toggle (lives at the top of this tab so the merchant
// always sees their open/closed state and can flip it in one click).
// Lives here, not in Settings, because it's an in-the-moment decision rather
// than a configuration setting.
// ---------------------------------------------------------------------------
const restaurant = ref<Restaurant | null>(null)
const showToggleModal = ref(false)
const togglingOpen = ref(false)
const toggleError = ref<string | null>(null)

const toggleTitle = computed(() =>
  restaurant.value?.isOpen ? 'Stop accepting new orders?' : 'Start accepting orders again?',
)
const toggleMessage = computed(() =>
  restaurant.value?.isOpen
    ? "Customers won't be able to place new orders until you turn this back on. Existing orders are unaffected."
    : 'Customers will be able to place new orders immediately.',
)
const toggleConfirmLabel = computed(() =>
  restaurant.value?.isOpen ? 'Yes, stop accepting' : 'Yes, start accepting',
)
const toggleTone = computed<'warn' | 'brand'>(() =>
  restaurant.value?.isOpen ? 'warn' : 'brand',
)

async function loadRestaurant() {
  try {
    restaurant.value = await fetchMerchantRestaurant()
  } catch (e) {
    flashActionError(e instanceof Error ? e.message : 'Failed to load restaurant')
  }
}

function requestToggle() {
  if (!restaurant.value) return
  toggleError.value = null
  showToggleModal.value = true
}

function dismissToggle() {
  if (togglingOpen.value) return
  showToggleModal.value = false
  toggleError.value = null
}

async function confirmToggle() {
  if (!restaurant.value) return
  togglingOpen.value = true
  toggleError.value = null
  try {
    const updated = await updateMerchantRestaurant({ isOpen: !restaurant.value.isOpen })
    restaurant.value = updated
    showToggleModal.value = false
  } catch (e) {
    toggleError.value = e instanceof Error ? e.message : 'Failed to update'
  } finally {
    togglingOpen.value = false
  }
}

onMounted(() => {
  loadOrders()
  loadRestaurant()
})

async function loadOrders() {
  loading.value = true
  error.value = null
  try {
    const dateArg = userPickedDate ? selectedDate.value : undefined
    const result = await fetchMerchantOrders(dateArg)
    orders.value = result.orders
    selectedDate.value = result.serviceDate
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load orders'
  } finally {
    loading.value = false
  }
}

function onDateChange() {
  userPickedDate = true
  loadOrders()
}

const NEXT_STATUS: Record<string, string> = {
  confirmed: 'preparing',
  preparing: 'delivered',
}

// Used by the review-payment modal customer line. The card-level lookups
// have moved into MerchantOrderCard.vue.
function customerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

const updatingOrder = ref<string | null>(null)

// ---------------------------------------------------------------------------
// Print receipt
// Uses Tailwind's `print:` modifier — the dashboard root has `print:hidden`,
// the OrderReceipt has `hidden print:block`. We mount the receipt, wait for
// Vue to flush it to the DOM, then trigger the browser print dialog. The
// `afterprint` event clears state so consecutive prints toggle cleanly.
// ---------------------------------------------------------------------------
const printingOrder = ref<Order | null>(null)

async function printOrder(order: Order) {
  printingOrder.value = order
  await nextTick()
  window.print()
}

function onAfterPrint() {
  printingOrder.value = null
}

onMounted(() => window.addEventListener('afterprint', onAfterPrint))
onUnmounted(() => window.removeEventListener('afterprint', onAfterPrint))

// Inline error banner for transient action failures (status advance, etc.).
// Auto-clears after a few seconds so the merchant doesn't have to dismiss it.
const actionError = ref<string | null>(null)
let actionErrorTimer: ReturnType<typeof setTimeout> | null = null
function flashActionError(message: string) {
  actionError.value = message
  if (actionErrorTimer) clearTimeout(actionErrorTimer)
  actionErrorTimer = setTimeout(() => {
    actionError.value = null
  }, 5000)
}

async function advance(order: Order) {
  const next = NEXT_STATUS[order.status]
  if (!next) return
  updatingOrder.value = order.id
  try {
    const updated = await updateOrderStatus(order.id, next)
    const idx = orders.value.findIndex((o) => o.id === order.id)
    if (idx !== -1) orders.value[idx] = updated
  } catch (e) {
    flashActionError(e instanceof Error ? e.message : 'Failed to update status')
  } finally {
    updatingOrder.value = null
  }
}

const totalRevenue = () =>
  orders.value.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0)

// ---------------------------------------------------------------------------
// Sorting + grouping
// "Awaiting payment" surfaces actionable orders (proof to verify, or customer
// hasn't paid yet) at the top, with merchant-action items first. Everything
// else falls under "Active orders". Within each group: newest first.
// ---------------------------------------------------------------------------

const AWAITING_STATUSES: Order['status'][] = ['awaiting_payment', 'pending_verification']

function byCreatedDesc(a: Order, b: Order): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

const awaitingOrders = computed(() => {
  return [...orders.value]
    .filter((o) => AWAITING_STATUSES.includes(o.status))
    .sort((a, b) => {
      // pending_verification first (needs merchant action), then by newest
      const aPriority = a.status === 'pending_verification' ? 0 : 1
      const bPriority = b.status === 'pending_verification' ? 0 : 1
      if (aPriority !== bPriority) return aPriority - bPriority
      return byCreatedDesc(a, b)
    })
})

const activeOrders = computed(() => {
  return [...orders.value]
    .filter((o) => !AWAITING_STATUSES.includes(o.status))
    .sort(byCreatedDesc)
})

// Stat counters
const awaitingCount = computed(() => awaitingOrders.value.length)
const confirmedCount = computed(
  () => orders.value.filter((o) => o.status === 'confirmed' || o.status === 'preparing').length,
)
const deliveredCount = computed(() => orders.value.filter((o) => o.status === 'delivered').length)

// ---------------------------------------------------------------------------
// Review-payment modal
// ---------------------------------------------------------------------------

const reviewOrder = ref<Order | null>(null)
const reviewProof = ref<PaymentProofView | null>(null)
const reviewLoading = ref(false)
const reviewError = ref<string | null>(null)
const reviewSubmitting = ref(false)
const showRejectForm = ref(false)
const rejectMode = ref<'request_new' | 'cancel'>('request_new')
const rejectReason = ref('')

async function openReview(order: Order) {
  reviewOrder.value = order
  reviewProof.value = null
  reviewError.value = null
  showRejectForm.value = false
  rejectMode.value = 'request_new'
  rejectReason.value = ''
  reviewLoading.value = true
  try {
    reviewProof.value = await fetchMerchantPaymentProof(order.id)
  } catch (e) {
    reviewError.value = e instanceof Error ? e.message : 'Could not load proof'
  } finally {
    reviewLoading.value = false
  }
}

function closeReview() {
  if (reviewSubmitting.value) return
  reviewOrder.value = null
  reviewProof.value = null
  reviewError.value = null
  showRejectForm.value = false
}

function replaceOrder(updated: Order) {
  const idx = orders.value.findIndex((o) => o.id === updated.id)
  if (idx !== -1) orders.value[idx] = updated
}

async function confirmPayment() {
  if (!reviewOrder.value) return
  reviewSubmitting.value = true
  reviewError.value = null
  try {
    const updated = await confirmMerchantPayment(reviewOrder.value.id)
    replaceOrder(updated)
    // Drop the submitting flag BEFORE closing — closeReview() blocks while
    // submitting is true (to prevent the user clicking the X mid-request).
    reviewSubmitting.value = false
    closeReview()
  } catch (e) {
    reviewError.value = e instanceof Error ? e.message : 'Could not confirm'
    reviewSubmitting.value = false
  }
}

async function submitRejection() {
  if (!reviewOrder.value) return
  reviewSubmitting.value = true
  reviewError.value = null
  try {
    const updated = await rejectMerchantPayment(reviewOrder.value.id, rejectMode.value, rejectReason.value)
    replaceOrder(updated)
    reviewSubmitting.value = false
    closeReview()
  } catch (e) {
    reviewError.value = e instanceof Error ? e.message : 'Could not reject'
    reviewSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 print:hidden">
    <AppHeader />

    <div class="max-w-2xl mx-auto px-4 py-6">
      <MerchantTabs />

      <!-- Accepting-orders toggle — high-frequency control, kept at the very
           top of the tab so it's the first thing the merchant sees. -->
      <div
        v-if="restaurant"
        class="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4 flex items-center gap-3"
        :class="restaurant.isOpen ? '' : 'ring-1 ring-amber-200 bg-amber-50/40'"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="font-semibold text-gray-900 text-sm">
              {{ restaurant.isOpen ? 'Accepting new orders' : 'Not accepting orders' }}
            </p>
            <span
              class="text-[10px] font-medium px-2 py-0.5 rounded-full"
              :class="restaurant.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'"
            >
              {{ restaurant.isOpen ? 'Open' : 'Closed' }}
            </span>
          </div>
          <p class="text-xs text-gray-500 mt-0.5">
            {{
              restaurant.isOpen
                ? 'Customers can place new orders right now.'
                : 'Customers see your restaurant as closed and cannot order.'
            }}
          </p>
        </div>
        <button
          type="button"
          @click="requestToggle"
          class="relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200 shrink-0"
          :class="restaurant.isOpen ? 'bg-brand-500' : 'bg-gray-300'"
          :aria-label="restaurant.isOpen ? 'Stop accepting orders' : 'Start accepting orders'"
        >
          <span
            class="inline-block w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5"
            :class="restaurant.isOpen ? 'translate-x-5' : 'translate-x-1'"
          />
        </button>
      </div>

      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="actionError"
          class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2 mb-4 flex items-start gap-2"
        >
          <span class="shrink-0">⚠️</span>
          <span class="flex-1">{{ actionError }}</span>
          <button
            type="button"
            @click="actionError = null"
            class="text-red-400 hover:text-red-600 text-lg leading-none -mt-0.5"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </Transition>

      <div class="flex items-center justify-between mb-5">
        <h1 class="font-bold text-gray-900 text-lg">Orders</h1>
        <input
          v-model="selectedDate"
          type="date"
          @change="onDateChange"
          class="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </div>

      <!-- Stats -->
      <div v-if="!loading && orders.length > 0" class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-gray-900">{{ orders.length }}</p>
          <p class="text-xs text-gray-400 mt-0.5">Total</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-amber-600">{{ awaitingCount }}</p>
          <p class="text-xs text-gray-400 mt-0.5">Awaiting</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-blue-600">{{ confirmedCount }}</p>
          <p class="text-xs text-gray-400 mt-0.5">Confirmed</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-green-600">{{ deliveredCount }}</p>
          <p class="text-xs text-gray-400 mt-0.5">Delivered</p>
        </div>
        <div class="col-span-2 sm:col-span-1 bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-brand-600">฿{{ totalRevenue() }}</p>
          <p class="text-xs text-gray-400 mt-0.5">Revenue</p>
        </div>
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="n in 4" :key="n" class="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />
      </div>

      <div v-else-if="error" class="text-red-600 text-sm">{{ error }}</div>

      <div v-else-if="orders.length === 0" class="text-center py-20 text-gray-400">
        <div class="text-5xl mb-3">📋</div>
        <p>No orders for {{ selectedDate }}</p>
      </div>

      <div v-else class="space-y-6">
        <!-- Awaiting payment group -->
        <section v-if="awaitingOrders.length > 0">
          <div class="flex items-center gap-2 mb-3">
            <h2 class="text-sm font-semibold text-gray-700">Awaiting payment</h2>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {{ awaitingOrders.length }}
            </span>
          </div>
          <div class="space-y-3">
            <div
              v-for="order in awaitingOrders"
              :key="order.id"
              class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              :class="order.status === 'pending_verification' ? 'ring-2 ring-yellow-200' : ''"
            >
              <MerchantOrderCard
                :order="order"
                :updating-id="updatingOrder"
                @review="openReview"
                @advance="advance"
                @print="printOrder"
              />
            </div>
          </div>
        </section>

        <!-- Active / completed group -->
        <section v-if="activeOrders.length > 0">
          <div class="flex items-center gap-2 mb-3">
            <h2 class="text-sm font-semibold text-gray-700">Active orders</h2>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {{ activeOrders.length }}
            </span>
          </div>
          <div class="space-y-3">
            <div
              v-for="order in activeOrders"
              :key="order.id"
              class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
            >
              <MerchantOrderCard
                :order="order"
                :updating-id="updatingOrder"
                @review="openReview"
                @advance="advance"
                @print="printOrder"
              />
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- ====== Review-payment modal ====== -->
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="reviewOrder"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6"
        @click.self="closeReview"
      >
        <div class="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto">
          <div class="px-5 pt-5 pb-3 sticky top-0 bg-white border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 class="font-bold text-gray-900 text-base">Verify payment</h2>
              <p class="text-xs text-gray-500">
                Order #{{ reviewOrder.id.slice(-6).toUpperCase() }} ·
                <span class="font-semibold text-gray-700">฿{{ reviewOrder.total }}</span>
              </p>
            </div>
            <button @click="closeReview" :disabled="reviewSubmitting" class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1">
              ×
            </button>
          </div>

          <div class="px-5 pt-4 pb-5 space-y-4">
            <!-- Customer line -->
            <div v-if="reviewOrder.customer" class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <img
                v-if="reviewOrder.customer.pictureUrl"
                :src="reviewOrder.customer.pictureUrl"
                :alt="reviewOrder.customer.displayName"
                class="w-9 h-9 rounded-full object-cover"
              />
              <div v-else class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
                {{ customerInitials(reviewOrder.customer.displayName) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 truncate">{{ reviewOrder.customer.displayName }}</p>
                <p class="text-xs text-gray-500 truncate">{{ reviewOrder.customer.email }}</p>
              </div>
            </div>

            <!-- Proof image -->
            <div v-if="reviewLoading" class="bg-gray-100 rounded-xl h-72 animate-pulse" />
            <div v-else-if="reviewError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
              ⚠️ {{ reviewError }}
            </div>
            <div v-else-if="reviewProof">
              <p class="text-xs text-gray-500 mb-1.5">
                Uploaded {{ new Date(reviewProof.uploadedAt).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) }}
              </p>
              <a :href="reviewProof.signedUrl" target="_blank" rel="noopener" class="block">
                <img
                  :src="reviewProof.signedUrl"
                  alt="Payment screenshot"
                  class="w-full max-h-[60vh] object-contain rounded-xl border border-gray-200 bg-gray-50"
                />
              </a>
              <p class="text-xs text-gray-400 mt-1.5">Tap the image to open it full-size in a new tab.</p>
            </div>

            <!-- Action area -->
            <div v-if="!showRejectForm" class="flex flex-col-reverse sm:flex-row gap-2">
              <button
                @click="showRejectForm = true"
                :disabled="reviewSubmitting || reviewLoading"
                class="flex-1 border border-red-200 text-red-600 disabled:opacity-60 rounded-xl py-3 font-medium text-sm hover:bg-red-50"
              >
                Reject
              </button>
              <button
                @click="confirmPayment"
                :disabled="reviewSubmitting || reviewLoading"
                class="flex-[2] bg-green-600 disabled:opacity-60 text-white rounded-xl py-3 font-semibold text-sm hover:bg-green-700"
              >
                {{ reviewSubmitting ? 'Confirming…' : '✓ Payment received' }}
              </button>
            </div>

            <div v-else class="space-y-3 border-t border-gray-100 pt-4">
              <p class="font-semibold text-gray-800 text-sm">Reject payment</p>

              <div class="space-y-2">
                <label class="flex items-start gap-2 p-3 rounded-xl border cursor-pointer" :class="rejectMode === 'request_new' ? 'border-brand-500 bg-brand-50' : 'border-gray-200'">
                  <input v-model="rejectMode" type="radio" value="request_new" class="mt-0.5" />
                  <div>
                    <p class="text-sm font-medium text-gray-800">Ask customer for a new screenshot</p>
                    <p class="text-xs text-gray-500">Order stays open. Customer can upload again.</p>
                  </div>
                </label>
                <label class="flex items-start gap-2 p-3 rounded-xl border cursor-pointer" :class="rejectMode === 'cancel' ? 'border-red-500 bg-red-50' : 'border-gray-200'">
                  <input v-model="rejectMode" type="radio" value="cancel" class="mt-0.5" />
                  <div>
                    <p class="text-sm font-medium text-gray-800">Cancel the order</p>
                    <p class="text-xs text-gray-500">Order is closed. Customer must place a new one.</p>
                  </div>
                </label>
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Reason (optional, shared with customer)</label>
                <textarea
                  v-model="rejectReason"
                  rows="2"
                  placeholder="e.g. Amount doesn't match — expected ฿180, screenshot shows ฿120"
                  class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>

              <div class="flex flex-col-reverse sm:flex-row gap-2">
                <button
                  @click="showRejectForm = false"
                  :disabled="reviewSubmitting"
                  class="flex-1 border border-gray-200 text-gray-700 disabled:opacity-60 rounded-xl py-3 font-medium text-sm hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  @click="submitRejection"
                  :disabled="reviewSubmitting"
                  class="flex-1 bg-red-600 disabled:opacity-60 text-white rounded-xl py-3 font-semibold text-sm hover:bg-red-700"
                >
                  {{ reviewSubmitting ? 'Rejecting…' : 'Confirm rejection' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <ConfirmModal
      :open="showToggleModal"
      :title="toggleTitle"
      :message="toggleMessage"
      :confirm-label="toggleConfirmLabel"
      cancel-label="Cancel"
      :tone="toggleTone"
      :loading="togglingOpen"
      :error-message="toggleError"
      @confirm="confirmToggle"
      @cancel="dismissToggle"
    />
  </div>

  <!-- Print-only receipt (hidden on screen, visible to the print dialog).
       Kept as a sibling of the dashboard root so the dashboard's
       `print:hidden` doesn't suppress it. -->
  <OrderReceipt v-if="printingOrder" :order="printingOrder" />
</template>
