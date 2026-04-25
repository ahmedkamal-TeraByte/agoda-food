<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { useCartStore } from '../stores/cart'
import { useUserStore } from '../stores/user'
import { sendOtp, verifyOtp } from '../services/api'
import { saveDraft } from '../services/checkoutDraft'

const router = useRouter()
const cart = useCartStore()
const user = useUserStore()

const isPlacing = ref(false)
const orderError = ref<string | null>(null)

const total = computed(() => cart.subtotal)

// --- Email-verification OTP modal ---
type OtpStep = 'email' | 'code'
const showOtpModal = ref(false)
const otpStep = ref<OtpStep>('email')
const otpEmail = ref(user.user?.email ?? '')
const otpCode = ref('')
const otpSending = ref(false)
const otpVerifying = ref(false)
const otpError = ref<string | null>(null)

function proceedToCheckout() {
  if (cart.items.length === 0 || !cart.activeRestaurantId) return
  saveDraft({
    restaurantId: cart.activeRestaurantId,
    restaurantName: cart.items[0]!.restaurantName,
    items: JSON.parse(JSON.stringify(cart.items)),
    subtotal: cart.subtotal,
    deliveryFee: 0,
    total: cart.subtotal,
    savedAt: new Date().toISOString(),
  })
  cart.clearCart()
  router.push('/checkout')
}

function submitOrder() {
  if (cart.items.length === 0 || !cart.activeRestaurantId) return

  if (!user.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: '/cart' } })
    return
  }

  isPlacing.value = true
  orderError.value = null

  if (!user.emailVerified) {
    openOtpModal()
    isPlacing.value = false
    return
  }

  proceedToCheckout()
}

function openOtpModal() {
  otpStep.value = 'email'
  otpEmail.value = user.user?.email ?? ''
  otpCode.value = ''
  otpError.value = null
  showOtpModal.value = true
}

function dismissOtpModal() {
  if (otpSending.value || otpVerifying.value) return
  showOtpModal.value = false
  otpError.value = null
  otpCode.value = ''
}

async function sendOtpCode() {
  if (!otpEmail.value.trim()) {
    otpError.value = 'Please enter your email address'
    return
  }
  otpSending.value = true
  otpError.value = null
  try {
    await sendOtp(otpEmail.value.trim(), 'user_verify')
    otpStep.value = 'code'
  } catch (e) {
    otpError.value = e instanceof Error ? e.message : 'Failed to send OTP'
  } finally {
    otpSending.value = false
  }
}

async function verifyOtpCode() {
  if (!otpCode.value.trim()) {
    otpError.value = 'Please enter the 6-digit code'
    return
  }
  otpVerifying.value = true
  otpError.value = null
  try {
    const { user: updatedUser } = await verifyOtp(otpEmail.value.trim(), 'user_verify', otpCode.value.trim())
    user.updateUser(updatedUser)
    showOtpModal.value = false
    proceedToCheckout()
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'OTP_INVALID') {
      otpError.value = 'Invalid or expired code. Please try again.'
    } else {
      otpError.value = e instanceof Error ? e.message : 'Failed to verify OTP'
    }
  } finally {
    otpVerifying.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-2xl mx-auto px-4 py-6">
      <!-- Empty state -->
      <div v-if="cart.items.length === 0" class="text-center py-24">
        <div class="text-6xl mb-4">🛒</div>
        <h2 class="font-bold text-gray-800 text-xl mb-2">Your cart is empty</h2>
        <p class="text-gray-500 text-sm mb-6">Add some dishes from your favourite restaurant</p>
        <button
          @click="router.push('/')"
          class="bg-brand-500 text-white px-6 py-3 rounded-2xl font-semibold"
        >
          Browse restaurants
        </button>
      </div>

      <div v-else>
        <div class="flex items-center gap-3 mb-6">
          <button @click="router.back()" class="text-brand-500 text-sm">← Back</button>
          <h1 class="font-bold text-gray-900 text-xl">Your order</h1>
        </div>

        <!-- From -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4 flex items-center gap-3">
          <span class="text-2xl">🏠</span>
          <div>
            <p class="text-xs text-gray-400 font-medium">From</p>
            <p class="font-semibold text-gray-900">{{ cart.items[0]?.restaurantName }}</p>
          </div>
        </div>

        <!-- Items -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 mb-4">
          <div
            v-for="item in cart.items"
            :key="item.menuItem.id"
            class="px-4 py-4 flex items-start gap-3"
          >
            <img
              v-if="item.menuItem.imageUrl"
              :src="item.menuItem.imageUrl"
              :alt="item.menuItem.name"
              class="w-16 h-16 rounded-xl object-cover shrink-0"
            />
            <div
              v-else
              class="w-16 h-16 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center text-2xl"
            >
              🍽️
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-900 text-sm">{{ item.menuItem.name }}</p>
              <p class="text-gray-400 text-xs mt-0.5 line-clamp-1">{{ item.menuItem.description }}</p>
              <input
                :value="item.note"
                @input="cart.setNote(item.menuItem.id, ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="Add a note (optional)"
                class="mt-2 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-300 text-gray-600 placeholder-gray-300"
              />
            </div>
            <div class="shrink-0 flex flex-col items-end gap-2">
              <p class="font-bold text-gray-900 text-sm">฿{{ item.menuItem.price * item.quantity }}</p>
              <div class="flex items-center gap-2">
                <button
                  @click="cart.removeItem(item.menuItem.id)"
                  class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm active:scale-95"
                >
                  −
                </button>
                <span class="text-sm font-bold w-4 text-center text-brand-600">{{ item.quantity }}</span>
                <button
                  @click="cart.addItem(item.menuItem, item.restaurantId, item.restaurantName)"
                  class="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center font-bold text-white text-sm active:scale-95"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 mb-4 space-y-2">
          <div class="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>฿{{ cart.subtotal }}</span>
          </div>
          <div class="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
            <span>Total</span>
            <span>฿{{ total }}</span>
          </div>
        </div>

        <!-- Guest sign-in hint -->
        <div
          v-if="!user.isLoggedIn"
          class="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2"
        >
          <span>🔐</span>
          <span>Sign in with LINE to place your order. You can keep browsing as a guest.</span>
        </div>

        <!-- General error -->
        <div v-if="orderError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          ⚠️ {{ orderError }}
        </div>

        <!-- Place order button -->
        <button
          @click="submitOrder"
          :disabled="isPlacing"
          class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-2xl py-4 font-bold text-base shadow-lg active:scale-[0.97] transition-transform"
        >
          <span v-if="!user.isLoggedIn">Sign in to place order · ฿{{ total }}</span>
          <span v-else>Place order · ฿{{ total }}</span>
        </button>
      </div>
    </div>

    <!-- Email verification OTP modal -->
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showOtpModal"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        @click.self="dismissOtpModal"
      >
        <div
          class="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-xl px-6 pt-6 pb-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="otp-modal-title"
        >
          <div class="flex flex-col items-center text-center mb-4">
            <div class="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-3xl mb-3">📧</div>
            <h2 id="otp-modal-title" class="text-lg font-bold text-gray-900 mb-1">Verify your email</h2>
            <p class="text-sm text-gray-500">
              You need to verify your email address before placing your first order.
            </p>
          </div>

          <!-- Step 1: enter email -->
          <div v-if="otpStep === 'email'" class="space-y-3">
            <input
              v-model="otpEmail"
              type="email"
              placeholder="you@agoda.com"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div v-if="otpError" class="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
              ⚠️ {{ otpError }}
            </div>
            <div class="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                @click="dismissOtpModal"
                :disabled="otpSending"
                class="flex-1 border border-gray-200 text-gray-700 disabled:opacity-60 rounded-xl py-3 font-medium text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                @click="sendOtpCode"
                :disabled="otpSending"
                class="flex-1 bg-blue-600 disabled:opacity-60 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-700"
              >
                {{ otpSending ? 'Sending…' : 'Send code' }}
              </button>
            </div>
          </div>

          <!-- Step 2: enter code -->
          <div v-else class="space-y-3">
            <p class="text-xs text-gray-500 text-center">
              We sent a 6-digit code to <strong class="text-gray-700">{{ otpEmail }}</strong>
            </p>
            <input
              v-model="otpCode"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="123456"
              class="w-full border border-gray-200 rounded-xl px-3 py-3 text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div v-if="otpError" class="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
              ⚠️ {{ otpError }}
            </div>
            <div class="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                @click="dismissOtpModal"
                :disabled="otpVerifying"
                class="flex-1 border border-gray-200 text-gray-700 disabled:opacity-60 rounded-xl py-3 font-medium text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                @click="verifyOtpCode"
                :disabled="otpVerifying"
                class="flex-1 bg-blue-600 disabled:opacity-60 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-700"
              >
                {{ otpVerifying ? 'Verifying…' : 'Verify & continue' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
