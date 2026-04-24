// Keep in sync with backend/src/models/Dish.ts DISH_TAGS
export const DISH_TAGS = ['Popular', 'Vegetarian', 'Vegan', 'Spicy', 'GlutenFree'] as const
export type DishTag = (typeof DISH_TAGS)[number]

export interface Dish {
  id: string
  restaurantId: string
  name: string
  description: string
  price: number // THB
  imageUrl: string
  category: string
  tags: DishTag[]
  isAvailable?: boolean
}

export interface Restaurant {
  id: string
  name: string
  cuisine: string
  rating: number
  reviewCount: number
  deliveryTime: string // e.g. "15–25 min"
  deliveryFee: number // THB, 0 = free
  minOrder: number // THB
  imageUrl: string
  logoUrl: string
  tags: string[]
  isOpen: boolean
}

// A restaurant detail fetched with its menu — used by RestaurantPage.
export interface RestaurantWithMenu extends Restaurant {
  menu: Dish[]
}

export interface CartItem {
  dish: Dish
  restaurantId: string
  restaurantName: string
  quantity: number
  note: string
}

export interface OrderItem {
  dishId: string
  name: string
  price: number
  imageUrl: string
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
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled'

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
  createdAt: string
}
