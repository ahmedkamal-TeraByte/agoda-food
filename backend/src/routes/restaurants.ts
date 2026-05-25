import { Router, Request, Response } from 'express'
import { Restaurant } from '@models/Restaurant'
import { MenuItem } from '@models/MenuItem'
import { requireUser } from '@middleware/auth'
import { generateOtp, verifyOtp } from '@lib/otp'
import { getPublicStorage } from '@lib/storage'
import { config } from '@config/AppConfig'

const router = Router()

// GET /api/restaurants — list (active only unless the caller owns one)
router.get('/', async (req: Request, res: Response) => {
  try {
    const authHeader = req.header('Authorization') ?? ''
    let callerId: string | null = null
    if (authHeader.startsWith('Bearer ')) {
      try {
        const { verifySession } = await import('@lib/jwt')
        callerId = verifySession(authHeader.slice(7).trim())
      } catch {
        // unauthenticated — fine
      }
    }

    // Build filter: public sees status=active only
    const filter = callerId
      ? { $or: [{ status: 'active' }, { ownerUserId: callerId }] }
      : { status: 'active' }

    const restaurants = await Restaurant.find(filter).sort({ createdAt: 1 })
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

// GET /api/restaurants/:id/menu — available dishes
router.get('/:id/menu', async (req: Request, res: Response) => {
  try {
    const menuItems = await MenuItem.find({
      restaurantId: req.params.id,
      isAvailable: true,
    }).sort({ category: 1, createdAt: 1 })
    const serialized = menuItems.map((item) => {
      const obj = item.toObject() as unknown as Record<string, unknown>
      obj.imageUrl = obj.imageKey
        ? getPublicStorage().publicUrl(obj.imageKey as string)
        : undefined
      return obj
    })
    res.json(serialized)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menu' })
  }
})

// POST /api/restaurants/apply — authenticated, creates a draft restaurant.
//
// Onboarding intentionally captures the bare minimum (name, cuisine, referral).
// Cover photo / logo are uploaded later from the merchant settings tab; we
// seed placeholder URLs here so the Restaurant model's required fields are
// satisfied.
const PLACEHOLDER_COVER_URL =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop'
const PLACEHOLDER_LOGO_URL =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&auto=format&fit=crop'

router.post(
  '/apply',
  requireUser,
  async (
    req: Request<
      object,
      object,
      {
        name?: string
        cuisine?: string
        referral?: { name?: string; email?: string }
      }
    >,
    res: Response,
  ) => {
    const { name, cuisine, referral } = req.body

    if (!name || !cuisine) {
      res.status(400).json({ error: 'name and cuisine are required' })
      return
    }
    if (!referral?.name || !referral?.email) {
      res.status(400).json({ error: 'referral.name and referral.email are required' })
      return
    }

    const agodaEmailDomain = config.domain().agodaEmailDomain
    const referralEmail = referral.email.trim().toLowerCase()
    if (!referralEmail.endsWith(`@${agodaEmailDomain}`)) {
      res.status(400).json({
        error: `Referral email must be an @${agodaEmailDomain} address`,
        code: 'INVALID_REFERRAL_DOMAIN',
      })
      return
    }

    try {
      // Send OTP to the referral email
      await generateOtp(referralEmail, 'referral_verify')
      console.log(`[restaurants/apply] OTP sent to referral ${referralEmail}`)

      const restaurant = await Restaurant.create({
        name: name.trim(),
        cuisine: cuisine.trim(),
        imageUrl: PLACEHOLDER_COVER_URL,
        logoUrl: PLACEHOLDER_LOGO_URL,
        rating: 0,
        reviewCount: 0,
        deliveryTime: '30–45 min',
        deliveryFee: 0,
        minOrder: 0,
        tags: [],
        isOpen: false,
        status: 'draft',
        ownerUserId: req.user!._id,
        referral: { name: referral.name.trim(), email: referralEmail },
        orderWindow: { openHour: 17, closeHour: 10, deliveryHour: 12 },
      })

      res.status(201).json(restaurant)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to create restaurant application' })
    }
  },
)

// POST /api/restaurants/:id/verify-referral — applicant submits OTP from referral email
router.post(
  '/:id/verify-referral',
  requireUser,
  async (req: Request<{ id: string }, object, { code?: string }>, res: Response) => {
    const { code } = req.body
    if (!code) {
      res.status(400).json({ error: 'code is required' })
      return
    }

    try {
      const restaurant = await Restaurant.findById(req.params.id)
      if (!restaurant) {
        res.status(404).json({ error: 'Restaurant not found' })
        return
      }
      if (restaurant.ownerUserId.toString() !== req.user!._id.toString()) {
        res.status(403).json({ error: 'You did not apply for this restaurant' })
        return
      }
      if (restaurant.status !== 'draft') {
        res.status(409).json({ error: 'Restaurant is already verified' })
        return
      }
      if (!restaurant.referral?.email) {
        res.status(400).json({ error: 'No referral email on record' })
        return
      }

      const valid = await verifyOtp(restaurant.referral.email, 'referral_verify', code.trim())
      if (!valid) {
        res.status(400).json({ error: 'Invalid or expired OTP', code: 'OTP_INVALID' })
        return
      }

      // Promote restaurant to active and owner to merchant role
      restaurant.status = 'active'
      restaurant.referral.verifiedAt = new Date()
      await restaurant.save()

      const user = req.user!
      if (user.role !== 'merchant') {
        user.role = 'merchant'
        await user.save()
      }

      res.json({ restaurant, user })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to verify referral' })
    }
  },
)

export default router
