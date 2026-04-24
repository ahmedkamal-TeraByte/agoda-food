import type { Restaurant, RestaurantWithMenu, Dish, Order } from '../data/types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

// Mongoose returns _id; normalise to id everywhere so UI code never sees raw DB fields.
function toDish(d: Record<string, unknown>): Dish {
  return {
    id: d._id as string,
    restaurantId: d.restaurantId as string,
    name: d.name as string,
    description: d.description as string,
    price: d.price as number,
    imageUrl: d.imageUrl as string,
    category: d.category as string,
    isPopular: (d.isPopular as boolean | undefined) ?? false,
    isVegetarian: (d.isVegetarian as boolean | undefined) ?? false,
    isAvailable: (d.isAvailable as boolean | undefined) ?? true,
  }
}

function toRestaurant(r: Record<string, unknown>): Restaurant {
  return {
    id: r._id as string,
    name: r.name as string,
    cuisine: r.cuisine as string,
    rating: r.rating as number,
    reviewCount: r.reviewCount as number,
    deliveryTime: r.deliveryTime as string,
    deliveryFee: r.deliveryFee as number,
    minOrder: r.minOrder as number,
    imageUrl: r.imageUrl as string,
    logoUrl: r.logoUrl as string,
    tags: r.tags as string[],
    isOpen: r.isOpen as boolean,
  }
}

function toOrder(o: Record<string, unknown>): Order {
  return {
    id: o._id as string,
    restaurantId: o.restaurantId as string,
    restaurantName: o.restaurantName as string,
    items: o.items as Order['items'],
    subtotal: o.subtotal as number,
    deliveryFee: o.deliveryFee as number,
    total: o.total as number,
    status: o.status as Order['status'],
    createdAt: o.createdAt as string,
  }
}

export async function fetchRestaurants(): Promise<Restaurant[]> {
  const data = await request<Record<string, unknown>[]>('/restaurants')
  return data.map(toRestaurant)
}

// Hits both the restaurant and its menu endpoints in parallel so the
// RestaurantPage only waits for one round-trip.
export async function fetchRestaurantWithMenu(id: string): Promise<RestaurantWithMenu> {
  const [restaurantRaw, dishesRaw] = await Promise.all([
    request<Record<string, unknown>>(`/restaurants/${id}`),
    request<Record<string, unknown>[]>(`/restaurants/${id}/menu`),
  ])
  return { ...toRestaurant(restaurantRaw), menu: dishesRaw.map(toDish) }
}

export interface PlaceOrderPayload {
  restaurantId: string
  items: { dishId: string; quantity: number; note?: string }[]
}

export async function placeOrder(payload: PlaceOrderPayload): Promise<Order> {
  const data = await request<Record<string, unknown>>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return toOrder(data)
}

export async function fetchOrder(id: string): Promise<Order> {
  const data = await request<Record<string, unknown>>(`/orders/${id}`)
  return toOrder(data)
}
