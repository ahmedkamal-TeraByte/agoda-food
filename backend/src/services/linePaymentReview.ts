import { Order, type IOrder } from '@models/Order'
import { Restaurant } from '@models/Restaurant'
import { User } from '@models/User'
import { Payment } from '@models/Payment'
import { getPrivateStorage } from '@lib/storage'
import { pushFlex, replyText } from '@lib/lineBot'
import { buildOrderDetailsBubble, type OrderActionButton } from '@lib/lineFlexBuilders'
import { buildMerchantOrderLiffUrl } from '@lib/lineLiff'

const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60 // 24h — long enough for a merchant to react
const PROOF_FILE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

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

  const signedUrl = await getPrivateStorage().getSignedUrl(
    order.paymentProof.fileKey,
    SIGNED_URL_TTL_SECONDS,
  )

  const orderId = (order._id as { toString(): string }).toString()
  const orderShortId = orderId.slice(-6).toUpperCase()

  const actions: OrderActionButton[] = [
    {
      kind: 'uri',
      label: 'Reject',
      style: 'secondary',
      uri: buildMerchantOrderLiffUrl(orderId),
    },
    {
      kind: 'postback',
      label: 'Approve',
      style: 'primary',
      color: '#16a34a',
      data: JSON.stringify({ action: 'APPROVE_PAYMENT', orderId }),
      displayText: 'Approving payment…',
    },
  ]

  const bubble = buildOrderDetailsBubble({
    orderShortId,
    status: order.status,
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      note: i.note,
    })),
    total: order.total,
    imageUrl: signedUrl,
    actions,
  })

  await pushFlex(
    owner.lineUserId,
    `New order #${orderShortId} — payment awaiting approval`,
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
