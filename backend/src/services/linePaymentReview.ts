import { Order, type IOrder } from '../models/Order'
import { Restaurant } from '../models/Restaurant'
import { User } from '../models/User'
import { Payment } from '../models/Payment'
import { privateStorage } from '../lib/storage'
import { pushFlex, replyText } from '../lib/lineBot'
import { buildPaymentProofReviewBubble } from '../lib/lineFlexBuilders'

const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60 // 24h — long enough for a merchant to react
const PROOF_FILE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

const LIFF_ID = process.env.LIFF_ID ?? ''
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL ?? ''

// ─── Push payment proof to merchant ──────────────────────────────────────────

/**
 * Sends a flex bubble (image + Approve/Reject buttons) to the restaurant
 * owner's LINE account when a customer uploads a payment proof.
 *
 * No-op when the merchant has no linked LINE account or when the LINE
 * messaging credentials are unset.
 */
export async function pushPaymentProofToMerchant(order: IOrder): Promise<void> {
  if (!order.paymentProof?.fileKey) return

  const restaurant = await Restaurant.findById(order.restaurantId).lean()
  if (!restaurant) return

  const owner = await User.findById(restaurant.ownerUserId).select('lineUserId').lean()
  if (!owner?.lineUserId) return

  const customer = await User.findById(order.userId).select('displayName').lean()
  const customerName = customer?.displayName ?? 'Guest'

  const signedUrl = await privateStorage.getSignedUrl(
    order.paymentProof.fileKey,
    SIGNED_URL_TTL_SECONDS,
  )

  const orderShortId = (order._id as { toString(): string }).toString().slice(-6).toUpperCase()
  const itemSummary = summariseItems(order.items)

  const liffUrl = buildReviewLiffUrl(order._id as { toString(): string })

  const bubble = buildPaymentProofReviewBubble({
    orderShortId,
    customerName,
    itemSummary,
    total: order.total,
    imageUrl: signedUrl,
    approvePostbackData: JSON.stringify({
      action: 'APPROVE_PAYMENT',
      orderId: (order._id as { toString(): string }).toString(),
    }),
    liffUrl,
  })

  await pushFlex(
    owner.lineUserId,
    `Payment proof — Order #${orderShortId}`,
    bubble,
  )
}

// ─── Approve payment (postback handler) ──────────────────────────────────────

/**
 * Handles the APPROVE_PAYMENT postback. Mirrors the dashboard's
 * "✓ Payment received" path in merchant.ts. Authorises that the LINE user
 * actually owns the restaurant before mutating anything.
 */
export async function handleApprovePayment({
  orderId,
  lineUserId,
  replyToken,
}: {
  orderId: string
  lineUserId: string
  replyToken: string
}): Promise<void> {
  const user = await User.findOne({ lineUserId }).lean()
  if (!user) {
    await replyText(replyToken, "We couldn't find your Agoda Food account. Please open the app once to link it.")
    return
  }

  const order = await Order.findById(orderId)
  if (!order) {
    await replyText(replyToken, 'Order not found.')
    return
  }

  const restaurant = await Restaurant.findById(order.restaurantId)
  if (!restaurant || restaurant.ownerUserId.toString() !== user._id.toString()) {
    await replyText(replyToken, 'You do not own this order.')
    return
  }

  if (order.status !== 'pending_verification') {
    const friendly =
      order.status === 'cancelled'
        ? 'This order has already been cancelled.'
        : order.status === 'confirmed'
          ? 'This payment was already approved.'
          : `This order has already moved to "${order.status}". Open the dashboard for details.`
    await replyText(replyToken, friendly)
    return
  }

  if (!order.paymentProof) {
    await replyText(replyToken, 'No payment proof on this order.')
    return
  }

  const now = new Date()
  const expireFileAt = new Date(now.getTime() + PROOF_FILE_RETENTION_MS)
  const fileKey = order.paymentProof.fileKey

  await Payment.updateOne(
    { orderId: order._id, provider: 'promptpay_byo', fileKey, status: 'pending' },
    {
      $set: {
        status: 'paid',
        reviewedAt: now,
        paidAt: now,
        reviewerNote: '',
        expireFileAt,
      },
    },
  )

  order.status = 'confirmed'
  order.paymentStatus = 'paid'
  order.paymentProof.status = 'verified'
  order.paymentProof.reviewedAt = now
  order.paymentProof.reviewerNote = ''
  await order.save()

  const orderShortId = (order._id as { toString(): string }).toString().slice(-6).toUpperCase()
  await replyText(replyToken, `Payment approved for Order #${orderShortId}.`)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function summariseItems(items: IOrder['items']): string {
  if (!items || items.length === 0) return ''
  const first = items[0]!
  const head = `${first.name} × ${first.quantity}`
  return items.length > 1 ? `${head} + ${items.length - 1} more` : head
}

/**
 * Builds a deep-link URL into the merchant dashboard's review-payment modal.
 * Prefers a LIFF URL (opens inside LINE) when LIFF_ID is set, otherwise falls
 * back to PUBLIC_APP_URL, otherwise a generic LINE landing page.
 */
function buildReviewLiffUrl(orderId: { toString(): string }): string {
  const id = orderId.toString()
  if (LIFF_ID) {
    return `https://liff.line.me/${LIFF_ID}/merchant?reviewOrderId=${id}`
  }
  if (PUBLIC_APP_URL) {
    return `${PUBLIC_APP_URL.replace(/\/$/, '')}/merchant?reviewOrderId=${id}`
  }
  return 'https://line.me'
}
