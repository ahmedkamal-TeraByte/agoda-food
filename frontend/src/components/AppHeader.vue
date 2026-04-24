<script setup lang="ts">
import { useCartStore } from '../stores/cart'
import { useRouter } from 'vue-router'

const cart = useCartStore()
const router = useRouter()
</script>

<template>
  <header class="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
    <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
      <button @click="router.push('/')" class="flex items-center gap-2">
        <span class="text-2xl">🍱</span>
        <span class="font-bold text-gray-900 text-lg">Agoda Food</span>
      </button>

      <button
        @click="router.push('/cart')"
        class="relative flex items-center gap-1.5 bg-brand-500 text-white px-4 py-2 rounded-full text-sm font-medium active:scale-95 transition-transform"
        :class="{ 'opacity-50 cursor-default': cart.totalItems === 0 }"
      >
        <span>🛒</span>
        <span>Cart</span>
        <span
          v-if="cart.totalItems > 0"
          class="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
        >
          {{ cart.totalItems }}
        </span>
      </button>
    </div>
  </header>
</template>
