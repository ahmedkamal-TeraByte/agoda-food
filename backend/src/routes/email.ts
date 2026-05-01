import { Router, Request, Response } from 'express'
import { requireUser } from '@middleware/auth'
import { generateOtp, verifyOtp } from '@lib/otp'

const router = Router()

/**
 * POST /api/auth/email/send-otp
 * Sends (logs to console in dev) a 6-digit OTP to the given email address.
 * Purpose must be 'user_verify' | 'referral_verify'.
 */
router.post(
  '/send-otp',
  requireUser,
  async (req: Request<object, object, { email?: string; purpose?: string }>, res: Response) => {
    const { email, purpose } = req.body
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email is required' })
      return
    }
    if (purpose !== 'user_verify' && purpose !== 'referral_verify') {
      res.status(400).json({ error: 'purpose must be user_verify or referral_verify' })
      return
    }

    const normalised = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
      res.status(400).json({ error: 'Invalid email address' })
      return
    }

    try {
      await generateOtp(normalised, purpose)
      res.json({ ok: true, message: 'OTP sent (check server console in dev)' })
    } catch (err) {
      console.error('[email/send-otp]', err)
      res.status(500).json({ error: 'Failed to generate OTP' })
    }
  },
)

/**
 * POST /api/auth/email/verify-otp
 * Verifies the OTP. On success for purpose=user_verify, sets user.email and
 * user.emailVerified = true.
 */
router.post(
  '/verify-otp',
  requireUser,
  async (
    req: Request<object, object, { email?: string; purpose?: string; code?: string }>,
    res: Response,
  ) => {
    const { email, purpose, code } = req.body
    if (!email || !purpose || !code) {
      res.status(400).json({ error: 'email, purpose, and code are required' })
      return
    }
    if (purpose !== 'user_verify' && purpose !== 'referral_verify') {
      res.status(400).json({ error: 'purpose must be user_verify or referral_verify' })
      return
    }

    const normalised = email.trim().toLowerCase()

    try {
      const valid = await verifyOtp(normalised, purpose, code.trim())
      if (!valid) {
        res.status(400).json({ error: 'Invalid or expired OTP', code: 'OTP_INVALID' })
        return
      }

      const user = req.user!
      if (purpose === 'user_verify') {
        user.email = normalised
        user.emailVerified = true
        await user.save()
      }

      res.json({ ok: true, user })
    } catch (err) {
      console.error('[email/verify-otp]', err)
      res.status(500).json({ error: 'Failed to verify OTP' })
    }
  },
)

export default router
