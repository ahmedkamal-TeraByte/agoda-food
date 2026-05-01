/**
 * Thin wrappers around the two LINE Login API endpoints we need.
 * No LINE SDK — just plain HTTPS calls so the dependency footprint stays minimal.
 */
import { config } from '@config/AppConfig'

const TOKEN_ENDPOINT = 'https://api.line.me/oauth2/v2.1/token'
const VERIFY_ENDPOINT = 'https://api.line.me/oauth2/v2.1/verify'

export interface LineTokens {
  access_token: string
  id_token: string
}

export interface LineClaims {
  sub: string       // LINE userId — our lineUserId foreign key
  name: string
  picture?: string
  email?: string
}

/**
 * Exchange the authorization code returned by LINE for tokens.
 * Used by the external-browser OAuth flow.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<LineTokens> {
  const { channelId, channelSecret } = config.line()

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: channelId,
    client_secret: channelSecret,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LINE token exchange failed (${res.status}): ${detail}`)
  }

  return res.json() as Promise<LineTokens>
}

/**
 * Verify an id_token issued by LINE (OAuth or LIFF) and extract user claims.
 * Both flows share this function so verification is always identical.
 */
export async function verifyIdToken(idToken: string): Promise<LineClaims> {
  const { channelId } = config.line()

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: channelId,
  })

  const res = await fetch(VERIFY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LINE id_token verification failed (${res.status}): ${detail}`)
  }

  const payload = (await res.json()) as {
    sub: string
    name?: string
    picture?: string
    email?: string
  }

  if (!payload.sub) throw new Error('LINE id_token missing sub claim')

  return {
    sub: payload.sub,
    name: payload.name ?? 'LINE User',
    picture: payload.picture,
    email: payload.email,
  }
}
