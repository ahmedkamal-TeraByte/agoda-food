<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { useCartStore } from '../stores/cart'
import { placeOrder, payOrder } from '../services/api'
import { readDraft, clearDraft, type CheckoutDraft } from '../services/checkoutDraft'

const router = useRouter()
const cart = useCartStore()

const draft = ref<CheckoutDraft | null>(null)

// Tracks whether we've successfully created the order. When true, leaving
// /checkout should NOT restore the cart (the items are now a real order).
const orderConfirmed = ref(false)

const isPaying = ref(false)
const payError = ref<string | null>(null)

onMounted(() => {
  const d = readDraft()
  if (!d) {
    router.replace('/cart')
    return
  }
  draft.value = d
})

// If the user navigates away from /checkout without successfully paying,
// restore their items to the cart so nothing is lost. This catches the
// "Back to cart" button, browser back, and any in-app navigation.
onBeforeRouteLeave(() => {
  if (orderConfirmed.value) return
  const d = readDraft()
  if (d) {
    cart.setItems(d.items)
    clearDraft()
  }
})

function shortRestaurantName(name: string) {
  return name.length > 32 ? name.slice(0, 32) + '…' : name
}

async function payWithPromptPay() {
  if (!draft.value) return
  isPaying.value = true
  payError.value = null
  try {
    const order = await placeOrder({
      restaurantId: draft.value.restaurantId,
      items: draft.value.items.map((i) => ({
        menuItemId: i.menuItem.id,
        quantity: i.quantity,
        note: i.note || undefined,
      })),
    })

    orderConfirmed.value = true
    clearDraft()

    // Best-effort: kick off the PromptPay payment so the QR is ready when
    // the user lands on /order/:id. If this fails, the order page lets the
    // user retry from there.
    try {
      await payOrder(order.id)
    } catch (err) {
      console.warn('[checkout] payOrder kickoff failed; user can retry on /order:', err)
    }

    router.replace(`/order/${order.id}`)
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'EMAIL_VERIFICATION_REQUIRED') {
      // Cart page is the gate; if we got here without verification, send the
      // user back so they can verify. Items will be restored automatically.
      router.replace('/cart')
      return
    }
    if (err.code === 'ORDER_WINDOW_CLOSED') {
      payError.value = 'Ordering is currently closed for this restaurant. Check the open hours on the restaurant page.'
      isPaying.value = false
      return
    }
    payError.value = err.message ?? 'Failed to place order'
    isPaying.value = false
  }
}

function backToCart() {
  router.push('/cart')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div v-if="draft" class="max-w-2xl mx-auto px-4 py-6">
      <div class="flex items-center gap-3 mb-4">
        <button @click="backToCart" class="text-brand-500 text-sm">← Back</button>
      </div>

      <div class="flex flex-col items-center text-center">
        <div class="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-4xl mb-5 shadow-inner">📝</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-1">Review your order</h1>
        <p class="text-gray-500 text-sm mb-6">Confirm details, then pay with PromptPay.</p>

        <!-- Order summary -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full text-left mb-4">
          <p class="text-xs text-gray-400 font-medium mb-1">From</p>
          <p class="font-semibold text-gray-900 mb-4">{{ shortRestaurantName(draft.restaurantName) }}</p>

          <div class="divide-y divide-gray-100">
            <div
              v-for="item in draft.items"
              :key="item.menuItem.id"
              class="py-2.5 flex items-center justify-between gap-2"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">{{ item.menuItem.name }}</p>
                <p v-if="item.note" class="text-xs text-gray-400 mt-0.5">Note: {{ item.note }}</p>
              </div>
              <div class="shrink-0 text-right">
                <span class="text-xs text-gray-400">× {{ item.quantity }}</span>
                <p class="text-sm font-semibold text-gray-900">฿{{ item.menuItem.price * item.quantity }}</p>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-100 mt-3 pt-3 space-y-1">
            <div class="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>฿{{ draft.subtotal }}</span>
            </div>
            <div class="flex justify-between text-sm text-gray-500">
              <span>Delivery</span>
              <span :class="draft.deliveryFee === 0 ? 'text-green-600' : ''">
                {{ draft.deliveryFee === 0 ? 'Free' : `฿${draft.deliveryFee}` }}
              </span>
            </div>
            <div class="flex justify-between font-bold text-gray-900 pt-1">
              <span>Total</span><span>฿{{ draft.total }}</span>
            </div>
          </div>
        </div>

        <!-- Pay error -->
        <div v-if="payError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 w-full">
          ⚠️ {{ payError }}
        </div>

        <!-- Action buttons -->
        <div class="w-full space-y-3">
          <button
            @click="payWithPromptPay"
            :disabled="isPaying"
            class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-2xl py-4 font-bold text-base shadow-lg active:scale-[0.97] transition-transform"
          >
            {{ isPaying ? 'Processing…' : `Pay ฿${draft.total} with PromptPay` }}
          </button>
          <button
            @click="backToCart"
            :disabled="isPaying"
            class="w-full border border-gray-200 text-gray-600 disabled:opacity-60 rounded-2xl py-3 font-medium text-sm hover:bg-gray-50"
          >
            Back to cart
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
