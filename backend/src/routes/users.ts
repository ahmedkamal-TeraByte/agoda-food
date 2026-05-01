import { Router, Request, Response } from 'express'
import { User } from '@models/User'
import { Order } from '@models/Order'
import { requireUser } from '@middleware/auth'

const router = Router()

// GET /api/users/me — includes computed needsOnboarding flag
router.get('/me', requireUser, (req: Request, res: Response) => {
  const u = req.user!
  res.json({
    ...u.toObject(),
    needsOnboarding: !u.email || !u.phone,
  })
})

interface UpdateMeBody {
  displayName?: string
  email?: string
  phone?: string
  deliveryLocation?: string
  pictureUrl?: string
}

// PATCH /api/users/me — edit own profile. lineUserId is immutable.
router.patch('/me', requireUser, async (req: Request<object, object, UpdateMeBody>, res: Response) => {
  const allowed: (keyof UpdateMeBody)[] = [
    'displayName',
    'email',
    'phone',
    'deliveryLocation',
    'pictureUrl',
  ]
  const updates: Partial<UpdateMeBody> = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  try {
    const updated = await User.findByIdAndUpdate(req.user!._id, updates, {
      new: true,
      runValidators: true,
    })
    if (!updated) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({
      ...updated.toObject(),
      needsOnboarding: !updated.email || !updated.phone,
    })
  } catch (err) {
    const mongoErr = err as { code?: number; message?: string }
    if (mongoErr.code === 11000) {
      res.status(409).json({ error: 'email already in use' })
      return
    }
    res.status(400).json({ error: (err as Error).message })
  }
})

// GET /api/users/me/orders — my orders newest first, optional pagination
router.get('/me/orders', requireUser, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const skip = Math.max(Number(req.query.skip) || 0, 0)
  try {
    const orders = await Order.find({ userId: req.user!._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
    res.json(orders)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

export default router
