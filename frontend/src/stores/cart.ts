import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { CartItem, MenuItem } from '../data/types'

const STORAGE_KEY = 'agoda_food_cart_v1'

function loadFromStorage(): CartItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CartItem[]) : []
  } catch {
    return []
  }
}

function saveToStorage(items: CartItem[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (items.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
  } catch {
    // Quota / privacy mode — non-fatal
  }
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>(loadFromStorage())

  watch(
    items,
    (next) => saveToStorage(next),
    { deep: true },
  )

  const totalItems = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  const subtotal = computed(() =>
    items.value.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0)
  )

  const activeRestaurantId = computed(() =>
    items.value.length > 0 ? items.value[0]!.restaurantId : null
  )

  function addItem(menuItem: MenuItem, restaurantId: string, restaurantName: string) {
    if (activeRestaurantId.value && activeRestaurantId.value !== restaurantId) {
      items.value = []
    }

    const existing = items.value.find((i) => i.menuItem.id === menuItem.id)
    if (existing) {
      existing.quantity += 1
    } else {
      items.value.push({ menuItem, restaurantId, restaurantName, quantity: 1, note: '' })
    }
  }

  function removeItem(menuItemId: string) {
    const idx = items.value.findIndex((i) => i.menuItem.id === menuItemId)
    if (idx === -1) return
    const item = items.value[idx]!
    if (item.quantity > 1) {
      item.quantity -= 1
    } else {
      items.value.splice(idx, 1)
    }
  }

  function setNote(menuItemId: string, note: string) {
    const item = items.value.find((i) => i.menuItem.id === menuItemId)
    if (item) item.note = note
  }

  function clearCart() {
    items.value = []
  }

  function setItems(next: CartItem[]) {
    items.value = next
  }

  function getQuantity(menuItemId: string): number {
    return items.value.find((i) => i.menuItem.id === menuItemId)?.quantity ?? 0
  }

  function wouldClearCartFor(restaurantId: string): boolean {
    return items.value.length > 0 && activeRestaurantId.value !== restaurantId
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
    setItems,
    getQuantity,
    wouldClearCartFor,
  }
})
