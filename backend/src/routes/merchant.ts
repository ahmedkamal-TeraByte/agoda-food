import { Router, Request, Response } from 'express'
import { Restaurant } from '../models/Restaurant'
import { MenuItem } from '../models/MenuItem'
import { Order } from '../models/Order'
import { requireMerchant } from '../middleware/auth'
import { getServiceDate } from '../lib/orderWindow'

const router = Router()

// All routes require merchant role
router.use(requireMerchant)

/**
 * Helper: find the restaurant owned by the current user, or 404.
 */
async function getOwnedRestaurant(userId: string) {
  return Restaurant.findOne({ ownerUserId: userId })
}

// GET /api/merchant/restaurant
router.get('/restaurant', async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString())
    if (!restaurant) {
      res.status(404).json({ error: 'No restaurant found for your account' })
      return
    }
    res.json(restaurant)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch restaurant' })
  }
})

// PATCH /api/merchant/restaurant
router.patch('/restaurant', async (req: Request, res: Response) => {
  const allowed = [
    'name',
    'cuisine',
    'imageUrl',
    'logoUrl',
    'minOrder',
    'deliveryFee',
    'isOpen',
    'orderWindow',
    'deliveryTime',
    'tags',
  ]
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString())
    if (!restaurant) {
      res.status(404).json({ error: 'No restaurant found for your account' })
      return
    }

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(restaurant as any)[key] = req.body[key]
      }
    }
    await restaurant.save()
    res.json(restaurant)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update restaurant' })
  }
})

// GET /api/merchant/menu-items
router.get('/menu-items', async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString())
    if (!restaurant) {
      res.status(404).json({ error: 'No restaurant found for your account' })
      return
    }
    const menuItems = await MenuItem.find({ restaurantId: restaurant._id }).sort({ category: 1, createdAt: 1 })
    res.json(menuItems)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menu items' })
  }
})

// POST /api/merchant/menu-items
router.post('/menu-items', async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString())
    if (!restaurant) {
      res.status(404).json({ error: 'No restaurant found for your account' })
      return
    }

    const { name, description, price, imageUrl, category, tags } = req.body
    if (!name || !description || price === undefined || !category) {
      res.status(400).json({ error: 'name, description, price, and category are required' })
      return
    }

    const menuItem = await MenuItem.create({
      restaurantId: restaurant._id,
      name,
      description,
      price,
      imageUrl,
      category,
      tags: tags ?? [],
      isAvailable: true,
    })
    res.status(201).json(menuItem)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create menu item' })
  }
})

// PATCH /api/merchant/menu-items/:menuItemId
router.patch('/menu-items/:menuItemId', async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString())
    if (!restaurant) {
      res.status(404).json({ error: 'No restaurant found for your account' })
      return
    }

    const menuItem = await MenuItem.findOne({ _id: req.params.menuItemId, restaurantId: restaurant._id })
    if (!menuItem) {
      res.status(404).json({ error: 'Menu item not found' })
      return
    }

    const allowed = ['name', 'description', 'price', 'imageUrl', 'category', 'tags', 'isAvailable']
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(menuItem as any)[key] = req.body[key]
      }
    }
    await menuItem.save()
    res.json(menuItem)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update menu item' })
  }
})

// DELETE /api/merchant/menu-items/:menuItemId
router.delete('/menu-items/:menuItemId', async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString())
    if (!restaurant) {
      res.status(404).json({ error: 'No restaurant found for your account' })
      return
    }

    const menuItem = await MenuItem.findOneAndDelete({ _id: req.params.menuItemId, restaurantId: restaurant._id })
    if (!menuItem) {
      res.status(404).json({ error: 'Menu item not found' })
      return
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete menu item' })
  }
})

// GET /api/merchant/orders?serviceDate=YYYY-MM-DD
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const restaurant = await getOwnedRestaurant(req.user!._id.toString())
    if (!restaurant) {
      res.status(404).json({ error: 'No restaurant found for your account' })
      return
    }

    let targetDate: Date
    if (req.query.serviceDate && typeof req.query.serviceDate === 'string') {
      targetDate = new Date(`${req.query.serviceDate}T00:00:00+07:00`)
    } else {
      // Default: today's service date
      const sd = getServiceDate(restaurant.orderWindow)
      targetDate = sd ?? new Date()
    }

    // Query orders whose serviceDate falls on the target calendar day (Bangkok)
    const startOfDay = new Date(targetDate)
    startOfDay.setUTCHours(0, 0, 0, 0)
    // Shift by -7h to convert Bangkok midnight to UTC midnight
    const bangkokOffset = 7 * 60 * 60 * 1000
    const dayStart = new Date(startOfDay.getTime() - bangkokOffset)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    const orders = await Order.find({
      restaurantId: restaurant._id,
      serviceDate: { $gte: dayStart, $lt: dayEnd },
    }).sort({ createdAt: 1 })

    res.json(orders)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

export default router
