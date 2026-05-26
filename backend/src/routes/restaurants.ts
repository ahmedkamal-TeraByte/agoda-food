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

// Onboarding intentionally captures the bare minimum (name, cuisine, referral).
// Cover photo / logo are uploaded later from the merchant settings tab; we
// seed placeholder URLs here so the Restaurant model's required fields are
// satisfied.
const PLACEHOLDER_COVER_URL =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop'
const PLACEHOLDER_LOGO_URL =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&auto=format&fit=crop'

/**
 * Validate an Agoda-domain referral email against the configured domain.
 * Returns the normalised (lowercased, trimmed) email on success, or null on
 * failure. The caller is responsible for sending the appropriate 400 response.
 */
function normaliseReferralEmail(email: string): string | null {
  const normalised = email.trim().toLowerCase()
  const domain = config.domain().agodaEmailDomain
  return normalised.endsWith(`@${domain}`) ? normalised : null
}

/**
 * Returns true if the user already owns an "established" (non-draft)
 * restaurant — used to reject duplicate applications.
 */
async function userHasActiveRestaurant(userId: string): Promise<boolean> {
  const existing = await Restaurant.findOne({
    ownerUserId: userId,
    status: { $ne: 'draft' },
  }).select('_id')
  return existing !== null
}

// POST /api/restaurants/apply/send-otp — step 1 of merchant onboarding.
//
// Only sends the referral OTP; deliberately does NOT create the Restaurant
// document yet. The old flow persisted a draft up-front, which leaked stale
// drafts whenever an applicant abandoned the OTP step.
router.post(
  '/apply/send-otp',
  requireUser,
  async (
    req: Request<object, object, { referralEmail?: string }>,
    res: Response,
  ) => {
    const { referralEmail } = req.body
    if (!referralEmail) {
      res.status(400).json({ error: 'referralEmail is required' })
      return
    }

    const email = normaliseReferralEmail(referralEmail)
    if (!email) {
      res.status(400).json({
        error: `Referral email must be an @${config.domain().agodaEmailDomain} address`,
        code: 'INVALID_REFERRAL_DOMAIN',
      })
      return
    }

    try {
      if (await userHasActiveRestaurant(req.user!._id.toString())) {
        res.status(409).json({
          error: 'You already have a restaurant',
          code: 'ALREADY_HAS_RESTAURANT',
        })
        return
      }

      // Clean up any orphaned drafts left behind by the old two-step flow
      // (pre-this-change). New apply flow never persists drafts, so any draft
      // owned by this user is dead data.
      await Restaurant.deleteMany({ ownerUserId: req.user!._id, status: 'draft' })

      await generateOtp(email, 'referral_verify')
      console.log(`[restaurants/apply] OTP sent to referral ${email}`)

      res.json({ ok: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to send verification code' })
    }
  },
)

// POST /api/restaurants/apply — step 2 (and final) of merchant onboarding.
//
// Verifies the OTP FIRST and only then persists the restaurant + promotes the
// user to merchant. If the OTP is invalid, nothing is written to the DB, so a
// page reload or close mid-flow never leaks a partial application.
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
        code?: string
      }
    >,
    res: Response,
  ) => {
    const { name, cuisine, referral, code } = req.body

    if (!name || !cuisine) {
      res.status(400).json({ error: 'name and cuisine are required' })
      return
    }
    if (!referral?.name || !referral?.email) {
      res.status(400).json({ error: 'referral.name and referral.email are required' })
      return
    }
    if (!code) {
      res.status(400).json({ error: 'code is required', code: 'OTP_MISSING' })
      return
    }

    const referralEmail = normaliseReferralEmail(referral.email)
    if (!referralEmail) {
      res.status(400).json({
        error: `Referral email must be an @${config.domain().agodaEmailDomain} address`,
        code: 'INVALID_REFERRAL_DOMAIN',
      })
      return
    }

    try {
      if (await userHasActiveRestaurant(req.user!._id.toString())) {
        res.status(409).json({
          error: 'You already have a restaurant',
          code: 'ALREADY_HAS_RESTAURANT',
        })
        return
      }

      const valid = await verifyOtp(referralEmail, 'referral_verify', code.trim())
      if (!valid) {
        res.status(400).json({ error: 'Invalid or expired OTP', code: 'OTP_INVALID' })
        return
      }

      // OTP is good — clean up stragglers and persist a fresh, active restaurant.
      await Restaurant.deleteMany({ ownerUserId: req.user!._id, status: 'draft' })

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
        status: 'active',
        ownerUserId: req.user!._id,
        referral: {
          name: referral.name.trim(),
          email: referralEmail,
          verifiedAt: new Date(),
        },
        orderWindow: { openHour: 17, closeHour: 10, deliveryHour: 12 },
      })

      const user = req.user!
      if (user.role !== 'merchant') {
        user.role = 'merchant'
        await user.save()
      }

      res.status(201).json({ restaurant, user })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to create restaurant' })
    }
  },
)

export default router
