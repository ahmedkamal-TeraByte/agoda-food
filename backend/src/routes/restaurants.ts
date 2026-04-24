import { Router, Request, Response } from 'express'
import { Restaurant } from '../models/Restaurant'
import { Dish } from '../models/Dish'

const router = Router()

// GET /api/restaurants — list
router.get('/', async (_req: Request, res: Response) => {
  try {
    const restaurants = await Restaurant.find({}).sort({ createdAt: 1 })
    res.json(restaurants)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch restaurants' })
  }
})

// GET /api/restaurants/:id — single restaurant metadata
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }
    res.json(restaurant)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch restaurant' })
  }
})

// GET /api/restaurants/:id/menu — all available dishes for a restaurant
router.get('/:id/menu', async (req: Request, res: Response) => {
  try {
    const dishes = await Dish.find({
      restaurantId: req.params.id,
      isAvailable: true,
    }).sort({ category: 1, createdAt: 1 })
    res.json(dishes)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menu' })
  }
})

export default router
