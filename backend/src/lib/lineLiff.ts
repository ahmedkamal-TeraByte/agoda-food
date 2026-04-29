/**
 * Helpers for building LIFF / web URLs that the LINE bot embeds in flex
 * buttons. Falls back gracefully when LIFF_ID isn't configured.
 */

const LIFF_ID = process.env.LIFF_ID ?? ''
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL ?? ''

/**
 * Deep link into the merchant dashboard for a specific order. Prefers a LIFF
 * URL (opens inside LINE), falls back to PUBLIC_APP_URL (regular browser),
 * and finally to a generic LINE landing page if neither is configured.
 */
export function buildMerchantOrderLiffUrl(orderId: string): string {
  if (LIFF_ID) {
    return `https://liff.line.me/${LIFF_ID}/merchant?reviewOrderId=${orderId}`
  }
  if (PUBLIC_APP_URL) {
    return `${PUBLIC_APP_URL.replace(/\/$/, '')}/merchant?reviewOrderId=${orderId}`
  }
  return 'https://line.me'
}
