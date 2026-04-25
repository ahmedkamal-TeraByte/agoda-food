<script setup lang="ts">
import type { MenuItem, MenuItemTag } from '../data/types'
import { useCartStore } from '../stores/cart'

const props = defineProps<{
  menuItem: MenuItem
  restaurantId: string
  restaurantName: string
}>()

const emit = defineEmits<{
  (e: 'request-switch-restaurant', payload: { menuItem: MenuItem; restaurantId: string; restaurantName: string }): void
}>()

const cart = useCartStore()

// If the cart already has items from a different restaurant, defer to the
// parent so it can show a confirmation modal. Otherwise, add directly.
function tryAdd() {
  if (cart.wouldClearCartFor(props.restaurantId)) {
    emit('request-switch-restaurant', {
      menuItem: props.menuItem,
      restaurantId: props.restaurantId,
      restaurantName: props.restaurantName,
    })
    return
  }
  cart.addItem(props.menuItem, props.restaurantId, props.restaurantName)
}

const TAG_STYLES: Record<MenuItemTag, { label: string; classes: string }> = {
  Popular: { label: '⭐ Popular', classes: 'bg-brand-500 text-white' },
  Vegetarian: { label: '🌿 Veg', classes: 'bg-green-500 text-white' },
  Vegan: { label: '🌱 Vegan', classes: 'bg-emerald-600 text-white' },
  Spicy: { label: '🌶️ Spicy', classes: 'bg-red-500 text-white' },
  GlutenFree: { label: 'GF', classes: 'bg-amber-500 text-white' },
}
</script>

<template>
  <!-- Compact row layout (no image) -->
  <div
    v-if="!menuItem.imageUrl"
    class="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3"
  >
    <div class="flex-1 min-w-0">
      <div class="flex flex-wrap gap-1 mb-1">
        <span
          v-for="tag in menuItem.tags"
          :key="tag"
          class="text-xs font-semibold px-2 py-0.5 rounded-full"
          :class="TAG_STYLES[tag].classes"
        >
          {{ TAG_STYLES[tag].label }}
        </span>
      </div>
      <h4 class="font-semibold text-gray-900 text-sm leading-tight">{{ menuItem.name }}</h4>
      <p class="text-gray-500 text-xs mt-0.5 line-clamp-2">{{ menuItem.description }}</p>
    </div>

    <div class="shrink-0 flex flex-col items-end gap-2">
      <span class="font-bold text-gray-900 text-sm">฿{{ menuItem.price }}</span>
      <div v-if="cart.getQuantity(menuItem.id) === 0">
        <button
          @click="tryAdd"
          class="flex items-center gap-1 bg-brand-500 text-white text-xs font-medium px-3 py-1.5 rounded-full active:scale-95 transition-transform"
        >
          <span class="text-sm leading-none">+</span> Add
        </button>
      </div>
      <div v-else class="flex items-center gap-1.5">
        <button
          @click="cart.removeItem(menuItem.id)"
          class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 text-sm active:scale-95"
        >
          −
        </button>
        <span class="font-bold text-brand-600 w-4 text-center text-sm">{{ cart.getQuantity(menuItem.id) }}</span>
        <button
          @click="tryAdd"
          class="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center font-bold text-white text-sm active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  </div>

  <!-- Card layout with image -->
  <div
    v-else
    class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
  >
    <div class="relative h-36 overflow-hidden">
      <img :src="menuItem.imageUrl" :alt="menuItem.name" class="w-full h-full object-cover" />
      <div class="absolute top-2 left-2 flex flex-wrap gap-1">
        <span
          v-for="tag in menuItem.tags"
          :key="tag"
          class="text-xs font-semibold px-2 py-0.5 rounded-full"
          :class="TAG_STYLES[tag].classes"
        >
          {{ TAG_STYLES[tag].label }}
        </span>
      </div>
    </div>

    <div class="p-3 flex-1 flex flex-col">
      <h4 class="font-semibold text-gray-900 text-sm leading-tight">{{ menuItem.name }}</h4>
      <p class="text-gray-500 text-xs mt-1 flex-1 line-clamp-2">{{ menuItem.description }}</p>

      <div class="flex items-center justify-between mt-3">
        <span class="font-bold text-gray-900">฿{{ menuItem.price }}</span>

        <div v-if="cart.getQuantity(menuItem.id) === 0">
          <button
            @click="tryAdd"
            class="flex items-center gap-1 bg-brand-500 text-white text-sm font-medium px-3 py-1.5 rounded-full active:scale-95 transition-transform"
          >
            <span class="text-base leading-none">+</span> Add
          </button>
        </div>

        <div v-else class="flex items-center gap-2">
          <button
            @click="cart.removeItem(menuItem.id)"
            class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 active:scale-95 transition-transform"
          >
            −
          </button>
          <span class="font-bold text-brand-600 w-4 text-center">{{ cart.getQuantity(menuItem.id) }}</span>
          <button
            @click="tryAdd"
            class="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center font-bold text-white active:scale-95 transition-transform"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
