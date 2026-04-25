<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { fetchMerchantOrders, updateOrderStatus } from '../services/api'
import type { Order } from '../data/types'

const router = useRouter()
const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// Selected date (default: today Bangkok)
const todayStr = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Bangkok' })
const selectedDate = ref(todayStr)

onMounted(() => loadOrders())

async function loadOrders() {
  loading.value = true
  error.value = null
  try {
    orders.value = await fetchMerchantOrders(selectedDate.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load orders'
  } finally {
    loading.value = false
  }
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  awaiting_payment: 'bg-amber-100 text-amber-700',
  pending: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-brand-100 text-brand-700',
  preparing: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

const NEXT_STATUS: Record<string, string> = {
  confirmed: 'preparing',
  preparing: 'delivered',
}

const updatingOrder = ref<string | null>(null)

async function advance(order: Order) {
  const next = NEXT_STATUS[order.status]
  if (!next) return
  updatingOrder.value = order.id
  try {
    const updated = await updateOrderStatus(order.id, next)
    const idx = orders.value.findIndex((o) => o.id === order.id)
    if (idx !== -1) orders.value[idx] = updated
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to update status')
  } finally {
    updatingOrder.value = null
  }
}

const totalRevenue = () =>
  orders.value.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0)
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-2xl mx-auto px-4 py-6">
      <!-- Nav tabs -->
      <div class="flex gap-2 mb-6 border-b border-gray-200">
        <button @click="router.push('/merchant')" class="pb-2 px-1 text-sm text-gray-500 hover:text-gray-700">Overview</button>
        <button @click="router.push('/merchant/menu')" class="pb-2 px-1 text-sm text-gray-500 hover:text-gray-700">Menu</button>
        <button class="pb-2 px-1 text-sm font-semibold text-brand-500 border-b-2 border-brand-500">Orders</button>
      </div>

      <div class="flex items-center justify-between mb-5">
        <h1 class="font-bold text-gray-900 text-lg">Orders</h1>
        <input
          v-model="selectedDate"
          type="date"
          @change="loadOrders"
          class="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </div>

      <!-- Stats -->
      <div v-if="!loading && orders.length > 0" class="grid grid-cols-3 gap-3 mb-5">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-gray-900">{{ orders.length }}</p>
          <p class="text-xs text-gray-400 mt-0.5">Total orders</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-green-600">{{ orders.filter(o => o.status === 'delivered').length }}</p>
          <p class="text-xs text-gray-400 mt-0.5">Delivered</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-brand-600">฿{{ totalRevenue() }}</p>
          <p class="text-xs text-gray-400 mt-0.5">Revenue</p>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-3">
        <div v-for="n in 4" :key="n" class="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-red-600 text-sm">{{ error }}</div>

      <!-- Empty -->
      <div v-else-if="orders.length === 0" class="text-center py-20 text-gray-400">
        <div class="text-5xl mb-3">📋</div>
        <p>No orders for {{ selectedDate }}</p>
      </div>

      <!-- Order cards -->
      <div v-else class="space-y-3">
        <div
          v-for="order in orders"
          :key="order.id"
          class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
        >
          <div class="flex items-start justify-between mb-3">
            <div>
              <p class="font-semibold text-gray-900 text-sm">Order #{{ order.id.slice(-6).toUpperCase() }}</p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ new Date(order.createdAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) }}
              </p>
            </div>
            <span class="text-xs font-medium px-2.5 py-1 rounded-full" :class="STATUS_COLORS[order.status]">
              {{ STATUS_LABELS[order.status] }}
            </span>
          </div>

          <div class="space-y-1 mb-3">
            <div v-for="item in order.items" :key="item.menuItemId" class="flex justify-between text-sm">
              <span class="text-gray-700">{{ item.name }} × {{ item.quantity }}</span>
              <span class="text-gray-500">฿{{ item.price * item.quantity }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-gray-100 pt-3">
            <span class="font-bold text-gray-900">฿{{ order.total }}</span>
            <button
              v-if="NEXT_STATUS[order.status]"
              @click="advance(order)"
              :disabled="updatingOrder === order.id"
              class="bg-brand-500 disabled:opacity-60 text-white px-4 py-1.5 rounded-xl text-xs font-semibold"
            >
              <span v-if="updatingOrder === order.id">Updating…</span>
              <span v-else-if="order.status === 'confirmed'">Start preparing</span>
              <span v-else-if="order.status === 'preparing'">Mark delivered</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
