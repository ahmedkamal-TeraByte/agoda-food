<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { fetchMerchantRestaurant, updateMerchantRestaurant } from '../services/api'
import type { Restaurant } from '../data/types'

const router = useRouter()

const restaurant = ref<Restaurant | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const saveError = ref<string | null>(null)
const saved = ref(false)

const form = reactive({
  name: '',
  cuisine: '',
  deliveryTime: '',
  deliveryFee: 0,
  minOrder: 0,
  isOpen: true,
  openHour: 17,
  closeHour: 10,
  deliveryHour: 12,
})

onMounted(async () => {
  try {
    const r = await fetchMerchantRestaurant()
    restaurant.value = r
    form.name = r.name
    form.cuisine = r.cuisine
    form.deliveryTime = r.deliveryTime
    form.deliveryFee = r.deliveryFee
    form.minOrder = r.minOrder
    form.isOpen = r.isOpen
    form.openHour = r.orderWindow?.openHour ?? 17
    form.closeHour = r.orderWindow?.closeHour ?? 10
    form.deliveryHour = r.orderWindow?.deliveryHour ?? 12
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load restaurant'
  } finally {
    loading.value = false
  }
})

async function save() {
  saving.value = true
  saveError.value = null
  saved.value = false
  try {
    const updated = await updateMerchantRestaurant({
      name: form.name,
      cuisine: form.cuisine,
      deliveryTime: form.deliveryTime,
      deliveryFee: form.deliveryFee,
      minOrder: form.minOrder,
      isOpen: form.isOpen,
      orderWindow: {
        openHour: form.openHour,
        closeHour: form.closeHour,
        deliveryHour: form.deliveryHour,
      },
    } as Partial<Restaurant>)
    restaurant.value = updated
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-2xl mx-auto px-4 py-6">
      <!-- Nav tabs -->
      <div class="flex gap-2 mb-6 border-b border-gray-200">
        <button class="pb-2 px-1 text-sm font-semibold text-brand-500 border-b-2 border-brand-500">Overview</button>
        <button @click="router.push('/merchant/menu')" class="pb-2 px-1 text-sm text-gray-500 hover:text-gray-700">Menu</button>
        <button @click="router.push('/merchant/orders')" class="pb-2 px-1 text-sm text-gray-500 hover:text-gray-700">Orders</button>
      </div>

      <div v-if="loading" class="space-y-4">
        <div class="h-8 bg-gray-200 rounded animate-pulse w-48" />
        <div class="h-64 bg-white rounded-2xl animate-pulse border border-gray-100" />
      </div>

      <div v-else-if="error" class="text-center py-20">
        <div class="text-5xl mb-3">⚠️</div>
        <p class="text-gray-700 mb-4">{{ error }}</p>
      </div>

      <div v-else-if="restaurant">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-xl font-bold text-gray-900">{{ restaurant.name }}</h1>
            <p class="text-gray-500 text-sm">{{ restaurant.cuisine }}</p>
          </div>
          <span
            class="text-xs font-medium px-3 py-1 rounded-full"
            :class="restaurant.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
          >
            {{ restaurant.isOpen ? 'Open' : 'Closed' }}
          </span>
        </div>

        <form @submit.prevent="save" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <h2 class="font-semibold text-gray-800">Restaurant settings</h2>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input v-model="form.name" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Cuisine</label>
              <input v-model="form.cuisine" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Delivery time</label>
              <input v-model="form.deliveryTime" type="text" placeholder="20–35 min" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Delivery fee (฿)</label>
              <input v-model.number="form.deliveryFee" type="number" min="0" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Min order (฿)</label>
              <input v-model.number="form.minOrder" type="number" min="0" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
          </div>

          <!-- Accept orders toggle -->
          <div class="flex items-center justify-between py-2 border-t border-gray-100">
            <div>
              <p class="font-medium text-gray-800 text-sm">Accept orders</p>
              <p class="text-xs text-gray-400">Customers can add items to cart when this is on</p>
            </div>
            <button
              type="button"
              @click="form.isOpen = !form.isOpen"
              class="relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none"
              :class="form.isOpen ? 'bg-brand-500' : 'bg-gray-200'"
            >
              <span
                class="inline-block w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5"
                :class="form.isOpen ? 'translate-x-5' : 'translate-x-1'"
              />
            </button>
          </div>

          <!-- Order window -->
          <div class="border-t border-gray-100 pt-4">
            <h3 class="font-semibold text-gray-800 mb-1 text-sm">Order window (Asia/Bangkok)</h3>
            <p class="text-xs text-gray-400 mb-3">
              When openHour &gt; closeHour the window wraps midnight (e.g. 17:00 – 10:00 the next morning).
            </p>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Opens at (hour)</label>
                <input v-model.number="form.openHour" type="number" min="0" max="23" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Closes at (hour)</label>
                <input v-model.number="form.closeHour" type="number" min="0" max="23" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Delivery at (hour)</label>
                <input v-model.number="form.deliveryHour" type="number" min="0" max="23" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
          </div>

          <div v-if="saveError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">{{ saveError }}</div>
          <div v-if="saved" class="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-3 py-2">✓ Saved successfully</div>

          <button type="submit" :disabled="saving" class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
