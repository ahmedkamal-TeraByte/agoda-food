import { Types } from 'mongoose'
import { User } from '@models/User'
import { Order } from '@models/Order'
import type { OrderStatus } from '@models/Order'
import { Restaurant } from '@models/Restaurant'
import { replyText, replyFlex, replyFlexWithText } from '@lib/lineBot'
import {
  buildCustomerOrderBubble,
  buildMerchantOrderBubble,
  bubblesOrCarousel,
  type OrderSummary,
} from '@lib/lineFlexBuilders'

const ACTIVE_STATUSES: OrderStatus[] = [
  'awaiting_payment',
  'pending_verification',
  'pending',
  'confirmed',
  'preparing',
  'in_delivery',
]

const MAX_BUBBLES = 12

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function handleMyActiveOrders({
  lineUserId,
  replyToken,
}: {
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

  if (user.role === 'merchant') {
    await handleMerchantActiveOrders(user._id, replyToken)
  } else {
    await handleCustomerActiveOrders(user._id, replyToken)
  }
}

// ─── Customer branch ──────────────────────────────────────────────────────────

async function handleCustomerActiveOrders(
  userId: Types.ObjectId,
  replyToken: string,
): Promise<void> {
  const [total, orders] = await Promise.all([
    Order.countDocuments({ userId, status: { $in: ACTIVE_STATUSES } }),
    Order.find({ userId, status: { $in: ACTIVE_STATUSES } })
      .sort({ createdAt: -1 })
      .limit(MAX_BUBBLES)
      .lean(),
  ])

  if (orders.length === 0) {
    await replyText(replyToken, "You have no active orders right now. 🍱")
    return
  }

  const bubbles = orders.map((o) =>
    buildCustomerOrderBubble(orderToSummary(o)),
  )
  const flex = bubblesOrCarousel(bubbles)
  const altText = `You have ${total} active order${total === 1 ? '' : 's'}`
  const overflow = total - orders.length

  if (overflow > 0) {
    await replyFlexWithText(
      replyToken,
      altText,
      flex,
      `+${overflow} more order${overflow === 1 ? '' : 's'} — open the dashboard to see all.`,
    )
  } else {
    await replyFlex(replyToken, altText, flex)
  }
}

// ─── Merchant branch ──────────────────────────────────────────────────────────

async function handleMerchantActiveOrders(
  ownerUserId: Types.ObjectId,
  replyToken: string,
): Promise<void> {
  const restaurantIds = await Restaurant.find({ ownerUserId }).distinct('_id')

  if (restaurantIds.length === 0) {
    await replyText(replyToken, 'No restaurants are linked to your account yet.')
    return
  }

  const [total, orders] = await Promise.all([
    Order.countDocuments({
      restaurantId: { $in: restaurantIds },
      status: { $in: ACTIVE_STATUSES },
    }),
    Order.find({
      restaurantId: { $in: restaurantIds },
      status: { $in: ACTIVE_STATUSES },
    })
      .sort({ createdAt: -1 })
      .limit(MAX_BUBBLES)
      .lean(),
  ])

  if (orders.length === 0) {
    await replyText(replyToken, 'No active orders right now. 🎉')
    return
  }

  // Bulk-load customers to avoid N+1
  const customerIds = [...new Set(orders.map((o) => o.userId.toString()))]
  const customers = await User.find({
    _id: { $in: customerIds.map((id) => new Types.ObjectId(id)) },
  })
    .select('_id displayName')
    .lean()
  const customerMap = new Map(customers.map((c) => [c._id.toString(), c.displayName]))

  const bubbles = orders.map((o) =>
    buildMerchantOrderBubble(
      orderToSummary(o),
      customerMap.get(o.userId.toString()) ?? 'Guest',
    ),
  )

  const flex = bubblesOrCarousel(bubbles)
  const altText = `${total} active order${total === 1 ? '' : 's'}`
  const overflow = total - orders.length

  if (overflow > 0) {
    await replyFlexWithText(
      replyToken,
      altText,
      flex,
      `+${overflow} more order${overflow === 1 ? '' : 's'} — open the merchant dashboard to see all.`,
    )
  } else {
    await replyFlex(replyToken, altText, flex)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function orderToSummary(o: {
  _id: Types.ObjectId
  restaurantName: string
  status: string
  items: { name: string; quantity: number; price: number; note?: string }[]
  total: number
  serviceDate?: Date
}): OrderSummary {
  const mongoId = o._id.toString()
  return {
    id: mongoId.slice(-6).toUpperCase(),
    mongoId,
    restaurantName: o.restaurantName,
    status: o.status,
    items: o.items,
    total: o.total,
    serviceDate: o.serviceDate ?? null,
  }
}
