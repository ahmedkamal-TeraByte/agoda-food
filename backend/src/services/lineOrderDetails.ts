import { Order } from '@models/Order'
import { Restaurant } from '@models/Restaurant'
import { User } from '@models/User'
import { getPrivateStorage } from '@lib/storage'
import { replyText, replyFlex } from '@lib/lineBot'
import {
  buildOrderDetailsBubble,
  type OrderActionButton,
} from '@lib/lineFlexBuilders'
import { buildMerchantOrderLiffUrl } from '@lib/lineLiff'

const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60

/**
 * Handles the ORDER_DETAILS postback fired when a merchant taps the "Details"
 * button on a bubble in their MY_ACTIVE_ORDERS carousel.
 *
 * Replies with the same reusable order-details bubble used by the
 * payment-proof push: header with status pill, optional proof image hero,
 * full item list (with notes), total, and status-appropriate footer buttons.
 */
export async function handleOrderDetails({
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
    await replyText(
      replyToken,
      "We couldn't find your Agoda Food account. Please open the app once to link it.",
    )
    return
  }

  const order = await Order.findById(orderId).lean()
  if (!order) {
    await replyText(replyToken, 'Order not found.')
    return
  }

  // Authorize: the LINE user must either own the restaurant or have placed the order.
  const restaurant = await Restaurant.findById(order.restaurantId).lean()
  const isMerchant =
    !!restaurant && restaurant.ownerUserId.toString() === user._id.toString()
  const isCustomer = order.userId.toString() === user._id.toString()
  if (!isMerchant && !isCustomer) {
    await replyText(replyToken, 'You do not have access to this order.')
    return
  }

  const orderShortId = order._id.toString().slice(-6).toUpperCase()

  // Always show the proof image when one exists — gives the merchant a quick
  // visual reference even after the payment has been approved.
  let imageUrl: string | undefined
  if (order.paymentProof?.fileKey) {
    imageUrl = await getPrivateStorage().getSignedUrl(
      order.paymentProof.fileKey,
      SIGNED_URL_TTL_SECONDS,
    )
  }

  const actions = buildActions({
    orderId: order._id.toString(),
    status: order.status,
    isMerchant,
  })

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
    imageUrl,
    actions,
  })

  await replyFlex(replyToken, `Order #${orderShortId}`, bubble)
}

function buildActions({
  orderId,
  status,
  isMerchant,
}: {
  orderId: string
  status: string
  isMerchant: boolean
}): OrderActionButton[] {
  const liffUrl = buildMerchantOrderLiffUrl(orderId)

  // Merchant + still awaiting verification → mirror the payment-proof push:
  // Reject (jumps to LIFF for the radio + reason flow) and Approve (postback).
  if (isMerchant && status === 'pending_verification') {
    return [
      {
        kind: 'uri',
        label: 'Reject',
        style: 'secondary',
        uri: liffUrl,
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
  }

  // Otherwise just give them a way back into the dashboard.
  return [
    {
      kind: 'uri',
      label: 'Open dashboard',
      style: 'primary',
      uri: liffUrl,
    },
  ]
}
