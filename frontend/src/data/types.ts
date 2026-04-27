export const MENU_ITEM_TAGS = ['Popular', 'Vegetarian', 'Vegan', 'Spicy', 'GlutenFree'] as const
export type MenuItemTag = (typeof MENU_ITEM_TAGS)[number]

export interface OrderWindow {
  openHour: number
  closeHour: number
  deliveryHour: number
}

export interface MenuItem {
  id: string
  restaurantId: string
  name: string
  description: string
  price: number
  imageKey?: string
  imageUrl?: string
  category?: string
  tags: MenuItemTag[]
  isAvailable?: boolean
}

export interface Restaurant {
  id: string
  name: string
  cuisine: string
  rating: number
  reviewCount: number
  deliveryTime: string
  deliveryFee: number
  minOrder: number
  imageUrl: string
  logoUrl: string
  tags: string[]
  categories: string[]
  isOpen: boolean
  status?: 'draft' | 'active' | 'suspended'
  ownerUserId: string
  orderWindow?: OrderWindow
  referral?: { name: string; email: string; verifiedAt?: string }
  /** Whether the merchant has uploaded a PromptPay QR (presence-only flag for UIs). */
  hasPromptPay?: boolean
}

export interface RestaurantWithMenu extends Restaurant {
  menu: MenuItem[]
}

export interface CartItem {
  menuItem: MenuItem
  restaurantId: string
  restaurantName: string
  quantity: number
  note: string
}

export interface OrderItem {
  menuItemId: string
  name: string
  price: number
  imageUrl?: string
  quantity: number
  note: string
}

export interface User {
  id: string
  displayName: string
  email?: string
  phone?: string
  pictureUrl?: string
  deliveryLocation?: string
  needsOnboarding?: boolean
  role?: 'customer' | 'merchant' | 'admin'
  emailVerified?: boolean
}

export type OrderStatus =
  | 'awaiting_payment'
  | 'pending_verification'
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'delivered'
  | 'cancelled'

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'

export type PaymentProofStatus = 'pending' | 'verified' | 'rejected'

/**
 * BYO-QR PromptPay payment payload returned by POST /orders/:id/pay and
 * GET /orders/:id/payment.
 *
 * The QR is regenerated server-side from the merchant's stored EMV string,
 * so it does NOT expire — we keep the field naming familiar to existing UI
 * code but drop the expiresAt countdown. The backend returns the merchant's
 * raw payload alongside the rendered PNG in case the UI ever wants it.
 */
export interface PromptPayQR {
  qrImageUrl: string
  qrPayload: string
  amount: number      // satang (THB × 100)
  currency: 'thb'
  paymentStatus: PaymentStatus
  proofStatus?: PaymentProofStatus
  proofUploadedAt?: string
}

export interface PaymentProof {
  fileKey: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
  status: PaymentProofStatus
  reviewedAt?: string
  reviewerNote?: string
}

/** Short-lived signed URL returned to the merchant for viewing a proof. */
export interface PaymentProofView {
  signedUrl: string
  expiresAt: string
  uploadedAt: string
  contentType: string
  sizeBytes: number
  status: PaymentProofStatus
}

export interface OrderCustomer {
  id: string
  displayName: string
  email?: string
  phone?: string
  pictureUrl?: string
}

export interface Order {
  id: string
  userId: string
  restaurantId: string
  restaurantName: string
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  total: number
  status: OrderStatus
  paymentStatus?: PaymentStatus
  paymentProof?: PaymentProof
  serviceDate?: string
  createdAt: string
  customer?: OrderCustomer
}
