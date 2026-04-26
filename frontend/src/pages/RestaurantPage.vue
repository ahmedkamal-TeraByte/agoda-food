<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import MenuItemCard from '../components/MenuItemCard.vue'
import { fetchRestaurantWithMenu } from '../services/api'
import { useCartStore } from '../stores/cart'
import { useOrderWindow } from '../composables/useOrderWindow'
import type { MenuItem, RestaurantWithMenu } from '../data/types'

const route = useRoute()
const router = useRouter()
const cart = useCartStore()

const restaurant = ref<RestaurantWithMenu | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

interface PendingAdd {
  menuItem: MenuItem
  restaurantId: string
  restaurantName: string
}
const pendingAdd = ref<PendingAdd | null>(null)
const showSwitchModal = ref(false)
const previousRestaurantName = ref<string | null>(null)

function onSwitchRequest(payload: PendingAdd) {
  pendingAdd.value = payload
  previousRestaurantName.value = cart.items[0]?.restaurantName ?? null
  showSwitchModal.value = true
}

function dismissSwitchModal() {
  showSwitchModal.value = false
  pendingAdd.value = null
  previousRestaurantName.value = null
}

function confirmSwitchRestaurant() {
  if (!pendingAdd.value) return
  const { menuItem, restaurantId, restaurantName } = pendingAdd.value
  cart.addItem(menuItem, restaurantId, restaurantName)
  dismissSwitchModal()
}

onMounted(async () => {
  try {
    restaurant.value = await fetchRestaurantWithMenu(route.params.id as string)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load restaurant'
  } finally {
    loading.value = false
  }
})

const UNCATEGORIZED = '__uncategorized__'

const categories = computed<string[]>(() => {
  if (!restaurant.value) return []
  const named = new Set<string>()
  let hasUncategorized = false
  for (const mi of restaurant.value.menu) {
    if (mi.category) named.add(mi.category)
    else hasUncategorized = true
  }
  const result = [...named]
  if (hasUncategorized) result.push(UNCATEGORIZED)
  return result
})

function categoryLabel(c: string): string {
  return c === UNCATEGORIZED ? 'Other' : c
}

function itemsByCategory(category: string) {
  if (!restaurant.value) return []
  if (category === UNCATEGORIZED) {
    return restaurant.value.menu.filter((mi) => !mi.category)
  }
  return restaurant.value.menu.filter((mi) => mi.category === category)
}

const orderWindow = computed(() => restaurant.value?.orderWindow)
const { isOpen: windowIsOpen, label: windowLabel, deliveryTimeLabel } = useOrderWindow(
  // Pass a reactive getter — the composable reads the value each tick
  { get openHour() { return orderWindow.value?.openHour ?? 17 },
    get closeHour() { return orderWindow.value?.closeHour ?? 10 },
    get deliveryHour() { return orderWindow.value?.deliveryHour ?? 12 } }
)
</script>

<template>
  <!-- Loading -->
  <div v-if="loading" class="min-h-screen bg-gray-50">
    <AppHeader />
    <div class="h-52 bg-gray-200 animate-pulse" />
    <div class="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div v-for="n in 4" :key="n" class="bg-white rounded-2xl h-28 animate-pulse border border-gray-100" />
    </div>
  </div>

  <!-- Error -->
  <div v-else-if="error" class="min-h-screen flex items-center justify-center text-gray-400">
    <div class="text-center">
      <div class="text-5xl mb-3">⚠️</div>
      <p class="font-medium text-gray-700">{{ error }}</p>
      <button @click="router.push('/')" class="mt-4 text-brand-500 underline text-sm">Go home</button>
    </div>
  </div>

  <!-- Not found -->
  <div v-else-if="!restaurant" class="min-h-screen flex items-center justify-center text-gray-400">
    <div class="text-center">
      <div class="text-5xl mb-3">🍽️</div>
      <p>Restaurant not found</p>
      <button @click="router.push('/')" class="mt-4 text-brand-500 underline text-sm">Go home</button>
    </div>
  </div>

  <div v-else class="min-h-screen bg-gray-50">
    <AppHeader />

    <!-- Hero image -->
    <div class="relative h-52 overflow-hidden">
      <img :src="restaurant.imageUrl" :alt="restaurant.name" class="w-full h-full object-cover" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <button
        @click="router.push('/')"
        class="absolute top-4 left-4 bg-white/20 backdrop-blur text-white p-2 rounded-full"
      >
        ← Back
      </button>
      <div class="absolute bottom-4 left-4 text-white">
        <h1 class="text-2xl font-bold">{{ restaurant.name }}</h1>
        <p class="text-white/80 text-sm">{{ restaurant.cuisine }}</p>
      </div>
    </div>

    <!-- Meta bar -->
    <div class="bg-white border-b border-gray-100 px-4 py-3">
      <div class="max-w-2xl mx-auto flex items-center gap-4 text-sm text-gray-600">
        <span class="flex items-center gap-1 font-semibold text-yellow-500">
          ★ <span class="text-gray-900">{{ restaurant.rating }}</span>
          <span class="text-gray-400 font-normal">({{ restaurant.reviewCount }})</span>
        </span>
        <span>·</span>
        <span>🕐 {{ restaurant.deliveryTime }}</span>
        <span>·</span>
        <span>{{ restaurant.deliveryFee === 0 ? '🎉 Free delivery' : `฿${restaurant.deliveryFee} delivery` }}</span>
      </div>
    </div>

    <!-- Order window banner -->
    <div
      v-if="restaurant.orderWindow"
      class="max-w-2xl mx-auto px-4 pt-4"
    >
      <div
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
        :class="windowIsOpen
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'"
      >
        <span>{{ windowIsOpen ? '🟢' : '🔴' }}</span>
        <span>{{ windowLabel }}</span>
        <span class="ml-auto text-xs opacity-70">Delivery at {{ deliveryTimeLabel }}</span>
      </div>
    </div>

    <!-- Different restaurant warning -->
    <div
      v-if="cart.items.length > 0 && cart.activeRestaurantId !== restaurant.id"
      class="max-w-2xl mx-auto mt-4 px-4"
    >
      <div class="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
        ⚠️ Adding items from <strong>{{ restaurant.name }}</strong> will clear your current cart from <strong>{{ cart.items[0]?.restaurantName }}</strong>.
      </div>
    </div>

    <!-- Menu -->
    <div class="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <section v-for="category in categories" :key="category">
        <h2 class="font-bold text-gray-900 text-base mb-3 flex items-center gap-2">
          <span class="w-1 h-5 bg-brand-500 rounded-full inline-block"></span>
          {{ categoryLabel(category) }}
        </h2>
        <div class="grid grid-cols-2 gap-3">
          <MenuItemCard
            v-for="menuItem in itemsByCategory(category)"
            :key="menuItem.id"
            :menu-item="menuItem"
            :restaurant-id="restaurant.id"
            :restaurant-name="restaurant.name"
            :class="{ 'col-span-2': !menuItem.imageUrl }"
            @request-switch-restaurant="onSwitchRequest"
          />
        </div>
      </section>
    </div>

    <!-- Switch-restaurant confirmation modal -->
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showSwitchModal"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        @click.self="dismissSwitchModal"
      >
        <div
          class="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-xl px-6 pt-6 pb-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-restaurant-title"
        >
          <div class="flex flex-col items-center text-center">
            <div class="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center text-3xl mb-3">⚠️</div>
            <h2 id="switch-restaurant-title" class="text-lg font-bold text-gray-900 mb-1">Start a new cart?</h2>
            <p class="text-sm text-gray-500">
              Your cart already has items from
              <span class="font-medium text-gray-700">{{ previousRestaurantName }}</span>.
            </p>
            <p class="text-sm text-gray-500 mt-1">
              Adding from
              <span class="font-medium text-gray-700">{{ pendingAdd?.restaurantName }}</span>
              will replace it.
            </p>
          </div>

          <div class="mt-5 flex flex-col-reverse sm:flex-row gap-2">
            <button
              @click="dismissSwitchModal"
              class="flex-1 border border-gray-200 text-gray-700 rounded-xl py-3 font-medium text-sm hover:bg-gray-50"
            >
              Keep cart
            </button>
            <button
              @click="confirmSwitchRestaurant"
              class="flex-1 bg-brand-500 text-white rounded-xl py-3 font-semibold text-sm hover:bg-brand-600"
            >
              Start new cart
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Floating cart button -->
    <Transition name="slide-up">
      <div
        v-if="cart.totalItems > 0 && cart.activeRestaurantId === restaurant.id"
        class="fixed bottom-6 left-0 right-0 flex justify-center z-40 px-4"
      >
        <button
          @click="router.push('/cart')"
          class="w-full max-w-sm bg-brand-500 text-white rounded-2xl py-4 font-bold text-base shadow-xl flex items-center justify-between px-5 active:scale-[0.97] transition-transform"
        >
          <span class="bg-brand-600 rounded-xl px-2.5 py-0.5 text-sm font-bold">{{ cart.totalItems }}</span>
          <span>View Cart</span>
          <span class="font-bold">฿{{ cart.subtotal }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
