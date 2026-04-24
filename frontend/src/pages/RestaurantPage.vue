<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import DishCard from '../components/DishCard.vue'
import { fetchRestaurantWithMenu } from '../services/api'
import { useCartStore } from '../stores/cart'
import type { RestaurantWithMenu } from '../data/types'

const route = useRoute()
const router = useRouter()
const cart = useCartStore()

const restaurant = ref<RestaurantWithMenu | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    restaurant.value = await fetchRestaurantWithMenu(route.params.id as string)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load restaurant'
  } finally {
    loading.value = false
  }
})

const categories = computed(() => {
  if (!restaurant.value) return []
  return [...new Set(restaurant.value.menu.map((m) => m.category))]
})

function itemsByCategory(category: string) {
  return restaurant.value?.menu.filter((m) => m.category === category) ?? []
}
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

    <!-- Different restaurant warning -->
    <div
      v-if="cart.items.length > 0 && cart.activeRestaurantId !== restaurant.id"
      class="max-w-2xl mx-auto mt-4 mx-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800"
    >
      ⚠️ Adding items from <strong>{{ restaurant.name }}</strong> will clear your current cart from <strong>{{ cart.items[0]?.restaurantName }}</strong>.
    </div>

    <!-- Menu -->
    <div class="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <section v-for="category in categories" :key="category">
        <h2 class="font-bold text-gray-900 text-base mb-3 flex items-center gap-2">
          <span class="w-1 h-5 bg-brand-500 rounded-full inline-block"></span>
          {{ category }}
        </h2>
        <div class="grid grid-cols-2 gap-3">
          <DishCard
            v-for="dish in itemsByCategory(category)"
            :key="dish.id"
            :dish="dish"
            :restaurant-id="restaurant.id"
            :restaurant-name="restaurant.name"
          />
        </div>
      </section>
    </div>

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
