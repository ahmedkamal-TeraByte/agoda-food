import liff from '@line/liff'

const LIFF_ID = import.meta.env.VITE_LIFF_ID as string | undefined

// The LINE in-app browser sets `Line/` in its UA. Using this as a pre-check
// lets us skip liff.init() entirely in regular desktop/mobile browsers, which
// avoids a spurious `client_id is required` error and keeps the web-app flow
// free of LIFF side effects.
function maybeInLineClient(): boolean {
  return typeof navigator !== 'undefined' && / Line\//i.test(navigator.userAgent)
}

// Cached init promise — liff.init must be called exactly once per page load.
let initPromise: Promise<void> | null = null

/**
 * Initialises the LIFF SDK. Safe to call multiple times — subsequent calls
 * return the same promise. No-op when VITE_LIFF_ID is unset, or when we are
 * clearly running in a regular browser (not the LINE in-app webview).
 */
export function initLiff(): Promise<void> {
  if (!LIFF_ID) return Promise.resolve()
  if (!maybeInLineClient()) return Promise.resolve()
  if (!initPromise) {
    initPromise = liff.init({ liffId: LIFF_ID })
  }
  return initPromise
}

/** True when the app is running inside the LINE in-app browser. */
export function isInLineClient(): boolean {
  if (!LIFF_ID || !maybeInLineClient()) return false
  return liff.isInClient()
}

/** True when the LIFF user is already authenticated (relevant inside LINE). */
export function isLiffLoggedIn(): boolean {
  return !!LIFF_ID && liff.isLoggedIn()
}

/**
 * Triggers LINE login inside the LIFF webview (redirects + returns).
 * Only call this from inside the LINE client.
 */
export function liffLogin(): void {
  liff.login()
}

/** Returns the LIFF id_token to be sent to POST /api/auth/line/liff. */
export function getLiffIdToken(): string | null {
  return liff.getIDToken()
}

/** Logs out from LIFF (only meaningful inside the LINE client). */
export function liffLogout(): void {
  if (LIFF_ID && liff.isLoggedIn()) liff.logout()
}
