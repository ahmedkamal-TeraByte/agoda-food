/**
 * Helpers for building LIFF / web URLs that the LINE bot embeds in flex
 * buttons. Falls back gracefully when LIFF_ID isn't configured.
 */
import { config } from '@config/AppConfig'

/**
 * Deep link into the merchant dashboard for a specific order. Prefers a LIFF
 * URL (opens inside LINE), falls back to PUBLIC_APP_URL (regular browser),
 * and finally to a generic LINE landing page if neither is configured.
 */
export function buildMerchantOrderLiffUrl(orderId: string): string {
  const { id: liffId, publicAppUrl } = config.liff()

  if (liffId) {
    return `https://liff.line.me/${liffId}/merchant?reviewOrderId=${orderId}`
  }
  if (publicAppUrl) {
    return `${publicAppUrl.replace(/\/$/, '')}/merchant?reviewOrderId=${orderId}`
  }
  return 'https://line.me'
}
