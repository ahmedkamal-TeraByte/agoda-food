<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { fetchMyOrders } from '../services/api'
import { useUserStore } from '../stores/user'
import type { Order } from '../data/types'

const router = useRouter()
const userStore = useUserStore()

const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  if (!userStore.isLoggedIn) {
    router.replace({ path: '/login', query: { redirect: '/orders' } })
    return
  }
  try {
    orders.value = await fetchMyOrders()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load orders'
  } finally {
    loading.value = false
  }
})

function shortId(id: string) {
  return id.slice(-6).toUpperCase()
}

// If we landed on /orders by clicking "Back to orders" from an order page,
// going back would loop the user back to that order. Detect that case and
// route them home instead.
function goBack() {
  const prev = router.options.history.state?.back
  if (typeof prev === 'string' && prev.startsWith('/order/')) {
    router.push('/')
  } else {
    router.back()
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_STYLES: Record<Order['status'], string> = {
  awaiting_payment: 'bg-amber-100 text-amber-700',
  pending_verification: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<Order['status'], string> = {
  awaiting_payment: 'Awaiting payment',
  pending_verification: 'Verifying payment',
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-2xl mx-auto px-4 py-6">
      <div class="flex items-center gap-3 mb-6">
        <button @click="goBack" class="text-brand-500 text-sm">← Back</button>
        <h1 class="font-bold text-gray-900 text-xl">My orders</h1>
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
          <div class="h-4 w-32 bg-gray-200 rounded mb-2" />
          <div class="h-3 w-48 bg-gray-100 rounded" />
        </div>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
        {{ error }}
      </div>

      <div v-else-if="orders.length === 0" class="text-center py-20">
        <div class="text-6xl mb-4">🧾</div>
        <h2 class="font-bold text-gray-800 text-xl mb-2">No orders yet</h2>
        <p class="text-gray-500 text-sm mb-6">Place your first order to see it here.</p>
        <button
          @click="router.push('/')"
          class="bg-brand-500 text-white px-6 py-3 rounded-2xl font-semibold"
        >
          Browse restaurants
        </button>
      </div>

      <div v-else class="space-y-3">
        <button
          v-for="order in orders"
          :key="order.id"
          @click="router.push(`/order/${order.id}`)"
          class="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 hover:bg-gray-50"
        >
          <div class="flex items-center justify-between mb-1.5">
            <p class="font-semibold text-gray-900">{{ order.restaurantName }}</p>
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full"
              :class="STATUS_STYLES[order.status]"
            >
              {{ STATUS_LABELS[order.status] }}
            </span>
          </div>
          <p class="text-xs text-gray-400 mb-2 font-mono">#{{ shortId(order.id) }} · {{ formatDate(order.createdAt) }}</p>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-500">{{ order.items.length }} item{{ order.items.length === 1 ? '' : 's' }}</span>
            <span v-if="order.status === 'awaiting_payment'" class="font-semibold text-amber-600">
              Pay ฿{{ order.total }} →
            </span>
            <span v-else class="font-bold text-gray-900">฿{{ order.total }}</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
