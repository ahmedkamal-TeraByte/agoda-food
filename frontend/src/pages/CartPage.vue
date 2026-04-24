<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { useCartStore } from '../stores/cart'
import { useUserStore } from '../stores/user'
import { placeOrder } from '../services/api'

const router = useRouter()
const cart = useCartStore()
const user = useUserStore()

const isPlacing = ref(false)
const orderError = ref<string | null>(null)

const deliveryFee = computed(() => {
  // Cart tracks the restaurantId; delivery fee comes from the restaurant
  // but since we stored it in the cart we just compute the total from cart.subtotal.
  // The backend will recalculate and return the real total on success.
  return 0
})

const total = computed(() => cart.subtotal + deliveryFee.value)

async function submitOrder() {
  if (cart.items.length === 0 || !cart.activeRestaurantId) return

  // Guest users must sign in first.
  if (!user.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: '/cart' } })
    return
  }

  // Logged-in users who haven't completed onboarding go there first.
  if (user.needsOnboarding) {
    router.push({ path: '/onboarding', query: { redirect: '/cart' } })
    return
  }

  isPlacing.value = true
  orderError.value = null

  try {
    const order = await placeOrder({
      restaurantId: cart.activeRestaurantId,
      items: cart.items.map((i) => ({
        dishId: i.dish.id,
        quantity: i.quantity,
        note: i.note || undefined,
      })),
    })
    cart.clearCart()
    router.push(`/order/${order.id}`)
  } catch (e) {
    const err = e as Error & { code?: string }
    // Backend double-check — redirect to onboarding if needed.
    if (err.code === 'PROFILE_INCOMPLETE') {
      router.push({ path: '/onboarding', query: { redirect: '/cart' } })
      return
    }
    orderError.value = err.message ?? 'Failed to place order'
    isPlacing.value = false
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
            :key="item.dish.id"
            class="px-4 py-4 flex items-start gap-3"
          >
            <img
              :src="item.dish.imageUrl"
              :alt="item.dish.name"
              class="w-16 h-16 rounded-xl object-cover shrink-0"
            />
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-900 text-sm">{{ item.dish.name }}</p>
              <p class="text-gray-400 text-xs mt-0.5 line-clamp-1">{{ item.dish.description }}</p>

              <!-- Note -->
              <input
                :value="item.note"
                @input="cart.setNote(item.dish.id, ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="Add a note (optional)"
                class="mt-2 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-300 text-gray-600 placeholder-gray-300"
              />
            </div>

            <div class="shrink-0 flex flex-col items-end gap-2">
              <p class="font-bold text-gray-900 text-sm">฿{{ item.dish.price * item.quantity }}</p>
              <div class="flex items-center gap-2">
                <button
                  @click="cart.removeItem(item.dish.id)"
                  class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm active:scale-95"
                >
                  −
                </button>
                <span class="text-sm font-bold w-4 text-center text-brand-600">{{ item.quantity }}</span>
                <button
                  @click="cart.addItem(item.dish, item.restaurantId, item.restaurantName)"
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
          <div class="flex justify-between text-sm text-gray-600">
            <span>Delivery fee</span>
            <span class="text-green-600 font-medium">{{ deliveryFee === 0 ? 'Free' : `฿${deliveryFee}` }}</span>
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

        <!-- Onboarding hint -->
        <div
          v-else-if="user.needsOnboarding"
          class="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2"
        >
          <span>📋</span>
          <span>Complete your profile (email + phone) to place an order.</span>
        </div>

        <!-- Error -->
        <div v-if="orderError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          ⚠️ {{ orderError }}
        </div>

        <!-- Place order button -->
        <button
          @click="submitOrder"
          :disabled="isPlacing"
          class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-2xl py-4 font-bold text-base shadow-lg active:scale-[0.97] transition-transform"
        >
          <span v-if="isPlacing">Placing order…</span>
          <span v-else-if="!user.isLoggedIn">Sign in to place order · ฿{{ total }}</span>
          <span v-else-if="user.needsOnboarding">Complete profile to order · ฿{{ total }}</span>
          <span v-else>Place order · ฿{{ total }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
