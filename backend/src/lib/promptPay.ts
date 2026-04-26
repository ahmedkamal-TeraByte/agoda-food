/**
 * PromptPay QR helpers.
 *
 * Workflow:
 *  - Restaurants upload a QR image during onboarding. We decode the EMV TLV
 *    payload string from it and store ONLY the string in MongoDB. The image
 *    itself is discarded — there is no PII in the payload (just the merchant
 *    PromptPay ID).
 *  - When a customer pays an order we re-render the QR on the fly from that
 *    string, using `qrcode`. This means we never serve back the merchant's
 *    original (potentially out-of-date / personalised) QR image.
 *
 * Reference: EMVCo Merchant Presented QR specification + Bank of Thailand
 * PromptPay merchant tag (29).
 */
import jsQR from 'jsqr'
import sharp from 'sharp'
import QRCode from 'qrcode'

/**
 * Decode the QR text payload from an uploaded image buffer.
 * Returns null if no QR is found or the image is invalid.
 *
 * Sharp is used to handle JPEG/PNG/WebP/HEIC/etc. and to downscale very large
 * images so jsQR's tracing is fast and reliable.
 */
export async function decodeQrFromImage(buffer: Buffer): Promise<string | null> {
  try {
    // Normalise to RGBA at a reasonable size. We try the original size first
    // for accuracy on small QRs; if that fails we'll retry at a few scales.
    const candidates = [1024, 1600, 800]

    for (const targetWidth of candidates) {
      const { data, info } = await sharp(buffer)
        .rotate()
        .resize({ width: targetWidth, withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
        inversionAttempts: 'attemptBoth',
      })
      if (code?.data) return code.data
    }
    return null
  } catch (err) {
    console.warn('[promptPay] decodeQrFromImage failed:', err)
    return null
  }
}

/**
 * Validate that a string is a plausible EMV (PromptPay-compatible) payload.
 * We deliberately do NOT verify the CRC since the QR may legitimately be
 * dynamic-amount (the customer's banking app handles validation), but we do
 * sanity-check the header fields and the presence of a merchant account
 * information tag.
 */
export function isPromptPayPayload(payload: string): boolean {
  if (!payload || typeof payload !== 'string') return false
  // Payload Format Indicator (00) length 02 value 01 → "000201"
  if (!payload.startsWith('000201')) return false

  // Must contain one of the PromptPay merchant account information tags.
  // Tag 29 = domestic merchant account info (the official PromptPay bank tag),
  // Tag 30 = secondary merchant account info, also used by some banks.
  const hasMerchantTag = /^00020[12].*?(29\d{2}|30\d{2})/.test(payload)
  if (!hasMerchantTag) return false

  // Country code tag (58) must be present and equal to "TH".
  if (!/5802TH/.test(payload)) return false

  return true
}

/**
 * Render the EMV payload back into a PNG QR code, encoded as a data URL so the
 * frontend can drop it straight into an <img>.
 *
 * We use medium error correction (M = ~15%) which is what most Thai banking
 * apps generate, with a wide quiet zone for reliable scanning.
 */
export async function renderQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 2,
    width: 512,
    color: { dark: '#000000', light: '#FFFFFF' },
  })
}
