import { Router, Request, Response } from 'express'
import { Order } from '../models/Order'
import { Restaurant } from '../models/Restaurant'
import { Dish } from '../models/Dish'

const router = Router()

interface OrderItemInput {
  dishId: string
  quantity: number
  note?: string
}

interface CreateOrderBody {
  restaurantId: string
  items: OrderItemInput[]
}

// POST /api/orders
router.post('/', async (req: Request<object, object, CreateOrderBody>, res: Response) => {
  const { restaurantId, items } = req.body

  if (!restaurantId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'restaurantId and at least one item are required' })
    return
  }

  try {
    const restaurant = await Restaurant.findById(restaurantId)
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }
    if (!restaurant.isOpen) {
      res.status(400).json({ error: 'Restaurant is not accepting orders' })
      return
    }

    // Fetch every requested dish in a single round-trip and index by id
    const dishIds = items.map((i) => i.dishId)
    const dishes = await Dish.find({
      _id: { $in: dishIds },
      restaurantId,
      isAvailable: true,
    })
    const dishMap = new Map(dishes.map((d) => [d._id.toString(), d]))

    // Snapshot each item so future price/name changes don't mutate past orders
    const resolvedItems = []
    for (const input of items) {
      const dish = dishMap.get(input.dishId)
      if (!dish) {
        res.status(400).json({ error: `Dish ${input.dishId} not available for this restaurant` })
        return
      }
      if (!Number.isInteger(input.quantity) || input.quantity < 1) {
        res.status(400).json({ error: `Quantity must be a positive integer for dish ${dish.name}` })
        return
      }
      resolvedItems.push({
        dishId: dish._id,
        name: dish.name,
        price: dish.price,
        imageUrl: dish.imageUrl,
        quantity: input.quantity,
        note: input.note ?? '',
      })
    }

    const subtotal = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const deliveryFee = restaurant.deliveryFee
    const total = subtotal + deliveryFee

    if (subtotal < restaurant.minOrder) {
      res.status(400).json({
        error: `Order subtotal ฿${subtotal} is below the minimum order ฿${restaurant.minOrder}`,
      })
      return
    }

    const order = await Order.create({
      restaurantId: restaurant._id,
      restaurantName: restaurant.name,
      items: resolvedItems,
      subtotal,
      deliveryFee,
      total,
    })

    res.status(201).json(order)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order' })
  }
})

// GET /api/orders/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }
    res.json(order)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' })
  }
})

export default router
