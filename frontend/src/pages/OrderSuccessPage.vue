<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { fetchOrder } from '../services/api'
import type { Order } from '../data/types'

const route = useRoute()
const router = useRouter()

const order = ref<Order | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    order.value = await fetchOrder(route.params.id as string)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load order'
  } finally {
    loading.value = false
  }
})

function shortId(id: string) {
  return id.slice(-6).toUpperCase()
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

    <div v-else-if="order" class="max-w-2xl mx-auto px-4 flex flex-col items-center text-center py-10">
      <div class="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner">
        ✅
      </div>
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Order placed!</h1>
      <p class="text-gray-500 text-sm mb-1">Your lunch order has been confirmed.</p>
      <p class="text-xs text-gray-400 mb-6 font-mono">Order #{{ shortId(order.id) }}</p>

      <!-- Order card -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full text-left mb-4">
        <p class="text-xs text-gray-400 font-medium mb-1">From</p>
        <p class="font-semibold text-gray-900 mb-4">{{ order.restaurantName }}</p>

        <div class="divide-y divide-gray-100">
          <div
            v-for="item in order.items"
            :key="item.dishId"
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

      <!-- Status + delivery info -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full text-left mb-8">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-2xl">🕐</span>
          <div>
            <p class="text-xs text-gray-400">Estimated delivery</p>
            <p class="font-bold text-gray-900">20–30 minutes</p>
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
    </div>
  </div>
</template>
