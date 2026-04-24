import { Router, Request, Response } from 'express'
import { User, IUser } from '../models/User'
import { exchangeCodeForTokens, verifyIdToken, LineClaims } from '../lib/line'
import { signSession } from '../lib/jwt'

const router = Router()

interface AuthResponse {
  token: string
  user: IUser
  needsOnboarding: boolean
}

/**
 * Upserts a User by lineUserId (the LINE `sub` claim).
 * - First login: creates the doc with whatever LINE provides (name, picture, email if scoped).
 * - Subsequent logins: never overwrites fields the user has manually edited.
 *   Only backfills pictureUrl if it was previously unset.
 */
async function resolveLineUser(claims: LineClaims): Promise<AuthResponse> {
  let user = await User.findOne({ lineUserId: claims.sub })

  if (!user) {
    user = await User.create({
      lineUserId: claims.sub,
      displayName: claims.name,
      pictureUrl: claims.picture,
      email: claims.email,
    })
  } else {
    // Backfill picture only if the user never had one; never clobber edited fields.
    if (!user.pictureUrl && claims.picture) {
      user.pictureUrl = claims.picture
      await user.save()
    }
  }

  const needsOnboarding = !user.email || !user.phone
  const token = signSession(user._id.toString())
  return { token, user, needsOnboarding }
}

/**
 * POST /api/auth/line/exchange
 * External-browser OAuth flow. Receives the authorization code from LINE,
 * exchanges it for tokens, verifies the id_token, upserts the user.
 */
router.post(
  '/line/exchange',
  async (req: Request<object, object, { code?: string; redirectUri?: string }>, res: Response) => {
    const { code, redirectUri } = req.body
    if (!code || !redirectUri) {
      res.status(400).json({ error: 'code and redirectUri are required' })
      return
    }

    try {
      const tokens = await exchangeCodeForTokens(code, redirectUri)
      const claims = await verifyIdToken(tokens.id_token)
      const result = await resolveLineUser(claims)
      res.json(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LINE exchange failed'
      res.status(502).json({ error: msg })
    }
  },
)

/**
 * POST /api/auth/line/liff
 * In-LINE LIFF flow. The LIFF SDK gives us an id_token directly — no code exchange needed.
 */
router.post(
  '/line/liff',
  async (req: Request<object, object, { idToken?: string }>, res: Response) => {
    const { idToken } = req.body
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required' })
      return
    }

    try {
      const claims = await verifyIdToken(idToken)
      const result = await resolveLineUser(claims)
      res.json(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LIFF token verification failed'
      res.status(502).json({ error: msg })
    }
  },
)

export default router
