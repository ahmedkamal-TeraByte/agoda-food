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
  imageUrl?: string
  category: string
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
  isOpen: boolean
  status?: 'draft' | 'active' | 'suspended'
  ownerUserId: string
  orderWindow?: OrderWindow
  referral?: { name: string; email: string; verifiedAt?: string }
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
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'delivered'
  | 'cancelled'

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'

export type PromptPayStatus = 'pending' | 'paid' | 'expired' | 'failed'

export interface PromptPayQR {
  paymentIntentId: string
  qrImageUrl: string
  qrSvgUrl: string
  qrData: string
  expiresAt: string   // ISO string from JSON
  amount: number      // satang (THB × 100)
  currency: 'thb'
  status?: PromptPayStatus  // absent on create response, present on GET /payment
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
  serviceDate?: string
  createdAt: string
}
