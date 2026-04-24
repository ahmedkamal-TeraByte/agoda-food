const STORAGE_KEY = 'agoda-food:oauth'
const CHANNEL_ID = import.meta.env.VITE_LINE_CHANNEL_ID as string | undefined

interface OAuthState {
  state: string
  redirectAfterLogin: string
}

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generates a CSRF `state`, stores it (+ the intended destination) in
 * sessionStorage, and returns the full LINE authorize URL to redirect to.
 */
export function buildLineAuthorizeUrl(redirectAfterLogin = '/'): string {
  if (!CHANNEL_ID) throw new Error('VITE_LINE_CHANNEL_ID is not set')

  const state = randomHex()
  const nonce = randomHex()
  const stored: OAuthState = { state, redirectAfterLogin }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

  const redirectUri = `${window.location.origin}/auth/line/callback`
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CHANNEL_ID,
    redirect_uri: redirectUri,
    state,
    scope: 'openid profile',
    nonce,
  })

  return `https://access.line.me/oauth2/v2.1/authorize?${params}`
}

/**
 * Reads and deletes the stored OAuth state.
 * Returns null if nothing was stored (e.g. direct navigation to /auth/line/callback).
 */
export function consumeOauthState(): OAuthState | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as OAuthState
  } catch {
    return null
  }
}
