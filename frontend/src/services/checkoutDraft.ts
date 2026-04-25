// Holds an unsubmitted cart in sessionStorage between CartPage → CheckoutPage.
// The order is only persisted to the backend once the user clicks "Pay" on the
// checkout page. Closing the tab discards the draft (sessionStorage scope).
import type { CartItem } from '../data/types'

const KEY = 'agoda_food_checkout_draft_v1'

export interface CheckoutDraft {
  restaurantId: string
  restaurantName: string
  items: CartItem[]
  subtotal: number
  deliveryFee: number
  total: number
  savedAt: string
}

export function saveDraft(draft: CheckoutDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // Quota or privacy mode — fail silently; the user will just see an empty
    // checkout page and can go back to /cart.
  }
}

export function readDraft(): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as CheckoutDraft
  } catch {
    return null
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}

export function hasDraft(): boolean {
  return readDraft() !== null
}
