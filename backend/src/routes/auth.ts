import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { User, IUser } from '@models/User'
import { exchangeCodeForTokens, verifyIdToken, LineClaims } from '@lib/line'
import { signSession } from '@lib/jwt'
import { config } from '@config/AppConfig'

const router = Router()

const IS_PROD = process.env.NODE_ENV === 'production'

// HttpOnly cookie that holds the OAuth `state` (CSRF token) plus where to send
// the user after a successful login. Lives on the server so Safari's per-tab
// sessionStorage and ITP can't lose it between the LINE redirect and callback.
const STATE_COOKIE = 'oauth_state'
const STATE_COOKIE_PATH = '/api/auth/line'
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000

interface OAuthStatePayload {
  state: string
  redirectAfterLogin: string
}

interface AuthResponse {
  token: string
  user: IUser
  needsOnboarding: boolean
}

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

function getCookie(req: Pick<Request, 'headers'>, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    if (trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1))
    }
  }
  return undefined
}

function setStateCookie(res: Response, payload: OAuthStatePayload): void {
  res.cookie(STATE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: STATE_COOKIE_PATH,
    maxAge: STATE_COOKIE_MAX_AGE_MS,
  })
}

function clearStateCookie(res: Response): void {
  res.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH })
}

function readStateCookie(req: Pick<Request, 'headers'>): OAuthStatePayload | null {
  const raw = getCookie(req, STATE_COOKIE)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<OAuthStatePayload>
    if (typeof parsed.state !== 'string') return null
    if (typeof parsed.redirectAfterLogin !== 'string') return null
    return { state: parsed.state, redirectAfterLogin: parsed.redirectAfterLogin }
  } catch {
    return null
  }
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
      // LINE has already verified the email address
      emailVerified: !!claims.email,
    })
  } else {
    let dirty = false
    if (!user.pictureUrl && claims.picture) {
      user.pictureUrl = claims.picture
      dirty = true
    }
    // Backfill emailVerified if LINE supplied an email this session
    if (claims.email && !user.emailVerified) {
      user.emailVerified = true
      dirty = true
    }
    if (dirty) await user.save()
  }

  const needsOnboarding = !user.email || !user.phone
  const token = signSession(user._id.toString())
  return { token, user, needsOnboarding }
}

/**
 * GET /api/auth/line/start?redirect=/some/path
 * Begins the LINE OAuth flow: stashes a random `state` in an HttpOnly cookie
 * and 302-redirects the user to LINE. Doing this server-side means the state
 * is bound to the browser (cookie), not to a single tab (sessionStorage),
 * which fixes the "State mismatch" error Safari sees when ITP or a new-tab
 * callback wipes per-tab storage.
 */
router.get('/line/start', (req: Request, res: Response) => {
  const { channelId, redirectUri } = config.line()

  if (!channelId || !redirectUri) {
    res.status(500).json({ error: 'LINE login is not configured' })
    return
  }

  // Only allow same-site relative paths so this can't be turned into an
  // open-redirect to an attacker's domain.
  const requested = typeof req.query.redirect === 'string' ? req.query.redirect : '/'
  const redirectAfterLogin =
    requested.startsWith('/') && !requested.startsWith('//') ? requested : '/'

  const state = randomToken()
  const nonce = randomToken()

  setStateCookie(res, { state, redirectAfterLogin })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    scope: 'openid profile',
    nonce,
  })
  res.redirect(`https://access.line.me/oauth2/v2.1/authorize?${params}`)
})

/**
 * POST /api/auth/line/exchange { code, state }
 * Frontend callback page hits this with the code+state from LINE. The state
 * is checked against the HttpOnly cookie set in /line/start (the cookie is
 * single-use: cleared regardless of outcome). On success we exchange the
 * code for tokens and return the session along with the redirect target the
 * server stashed in the cookie.
 */
router.post(
  '/line/exchange',
  async (req: Request<object, object, { code?: string; state?: string }>, res: Response) => {
    const { code, state } = req.body
    const stored = readStateCookie(req)
    clearStateCookie(res)

    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' })
      return
    }
    if (!stored) {
      res.status(400).json({
        error: 'Login session expired or missing. Please try logging in again.',
      })
      return
    }
    if (stored.state !== state) {
      res.status(400).json({ error: 'State mismatch — possible CSRF.' })
      return
    }

    try {
      const tokens = await exchangeCodeForTokens(code, config.line().redirectUri)
      const claims = await verifyIdToken(tokens.id_token)
      const result = await resolveLineUser(claims)
      res.json({ ...result, redirectAfterLogin: stored.redirectAfterLogin })
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
