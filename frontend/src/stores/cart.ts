import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CartItem, Dish } from '../data/types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const totalItems = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  const subtotal = computed(() =>
    items.value.reduce((sum, item) => sum + item.dish.price * item.quantity, 0)
  )

  const activeRestaurantId = computed(() =>
    items.value.length > 0 ? items.value[0]!.restaurantId : null
  )

  function addItem(dish: Dish, restaurantId: string, restaurantName: string) {
    // Adding from a different restaurant clears the cart first.
    if (activeRestaurantId.value && activeRestaurantId.value !== restaurantId) {
      items.value = []
    }

    const existing = items.value.find((i) => i.dish.id === dish.id)
    if (existing) {
      existing.quantity += 1
    } else {
      items.value.push({ dish, restaurantId, restaurantName, quantity: 1, note: '' })
    }
  }

  function removeItem(dishId: string) {
    const idx = items.value.findIndex((i) => i.dish.id === dishId)
    if (idx === -1) return
    const item = items.value[idx]!
    if (item.quantity > 1) {
      item.quantity -= 1
    } else {
      items.value.splice(idx, 1)
    }
  }

  function setNote(dishId: string, note: string) {
    const item = items.value.find((i) => i.dish.id === dishId)
    if (item) item.note = note
  }

  function clearCart() {
    items.value = []
  }

  function getQuantity(dishId: string): number {
    return items.value.find((i) => i.dish.id === dishId)?.quantity ?? 0
  }

  return {
    items,
    totalItems,
    subtotal,
    activeRestaurantId,
    addItem,
    removeItem,
    setNote,
    clearCart,
    getQuantity,
  }
})
