/**
 * LINE Flex Message bubble builders.
 *
 * All return types come from @line/bot-sdk so misspellings (e.g. paddingStart
 * vs paddingLeft) get caught at compile time. Colors mirror the Tailwind
 * classes used in MerchantOrderCard.vue so the bot and the dashboard feel
 * consistent.
 */

import type { messagingApi } from '@line/bot-sdk'

type FlexBubble = messagingApi.FlexBubble
type FlexBox = messagingApi.FlexBox
type FlexComponent = messagingApi.FlexComponent
type FlexContainer = messagingApi.FlexContainer

export interface OrderSummary {
  /** Display-only short id (last 6 chars of the Mongo ObjectId, uppercase). */
  id: string
  /** Full Mongo ObjectId — used as the postback orderId. */
  mongoId: string
  restaurantName: string
  status: string
  items: { name: string; quantity: number; price: number; note?: string }[]
  total: number
  serviceDate?: Date | null
}

// ─── Status pill ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  pending_verification: 'Verify payment',
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  in_delivery: 'In Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

// Hex equivalents of the Tailwind color classes in MerchantOrderCard.vue
const STATUS_COLORS: Record<string, string> = {
  awaiting_payment: '#d97706', // amber-600
  pending_verification: '#ca8a04', // yellow-600
  pending: '#2563eb', // blue-600
  confirmed: '#f97316', // brand-500 / orange-500
  preparing: '#9333ea', // purple-600
  in_delivery: '#0284c7', // sky-600
  delivered: '#16a34a', // green-600
  cancelled: '#dc2626', // red-600
}

function statusPill(status: string): FlexBox {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: STATUS_COLORS[status] ?? '#6b7280',
    cornerRadius: '12px',
    paddingTop: '3px',
    paddingBottom: '3px',
    paddingStart: '10px',
    paddingEnd: '10px',
    contents: [
      {
        type: 'text',
        text: STATUS_LABELS[status] ?? status,
        size: 'xxs',
        color: '#ffffff',
        weight: 'bold',
      },
    ],
  }
}

// ─── Shared header ───────────────────────────────────────────────────────────

function orderHeader(orderId: string, status: string): FlexBox {
  return {
    type: 'box',
    layout: 'horizontal',
    backgroundColor: '#fff7ed',
    paddingAll: '12px',
    alignItems: 'center',
    contents: [
      {
        type: 'text',
        text: `#${orderId}`,
        weight: 'bold',
        size: 'md',
        color: '#111827',
        flex: 1,
      },
      statusPill(status),
    ],
  }
}

// ─── Item list rows ──────────────────────────────────────────────────────────

function itemRow(item: OrderSummary['items'][number]): FlexBox {
  const line: FlexBox = {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: `${item.name} × ${item.quantity}`,
        size: 'sm',
        color: '#374151',
        flex: 1,
        wrap: true,
      },
      {
        type: 'text',
        text: `฿${item.price * item.quantity}`,
        size: 'sm',
        color: '#6b7280',
        align: 'end',
        flex: 0,
      },
    ],
  }

  const note = item.note?.trim()
  if (!note) return line

  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    contents: [
      line,
      {
        type: 'text',
        text: `Note: ${note}`,
        size: 'xs',
        color: '#b45309',
        wrap: true,
        margin: 'xs',
      },
    ],
  }
}

function totalRow(total: number): FlexBox {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: 'Total', weight: 'bold', size: 'sm', color: '#111827', flex: 1 },
      {
        type: 'text',
        text: `฿${total}`,
        weight: 'bold',
        size: 'sm',
        color: '#f97316',
        align: 'end',
        flex: 0,
      },
    ],
  }
}

// ─── Customer bubble ─────────────────────────────────────────────────────────

export function buildCustomerOrderBubble(order: OrderSummary): FlexBubble {
  return {
    type: 'bubble',
    size: 'kilo',
    header: orderHeader(order.id, order.status),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      contents: [
        {
          type: 'text',
          text: order.restaurantName,
          weight: 'bold',
          size: 'sm',
          color: '#374151',
          wrap: true,
        },
        { type: 'separator', margin: 'sm' },
        ...order.items.map(itemRow),
        { type: 'separator', margin: 'sm' },
        totalRow(order.total),
      ],
    },
  }
}

// ─── Merchant bubble ─────────────────────────────────────────────────────────

export function buildMerchantOrderBubble(
  order: OrderSummary,
  customerName: string,
): FlexBubble {
  const bodyContents: FlexComponent[] = [
    {
      type: 'box',
      layout: 'horizontal',
      alignItems: 'center',
      contents: [
        { type: 'text', text: '👤', size: 'sm', flex: 0 },
        {
          type: 'text',
          text: customerName,
          size: 'sm',
          weight: 'bold',
          color: '#374151',
          flex: 1,
          margin: 'sm',
          wrap: true,
        },
      ],
    },
  ]

  if (order.serviceDate) {
    const label = new Date(order.serviceDate).toLocaleDateString('en-GB', {
      timeZone: 'Asia/Bangkok',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    bodyContents.push({
      type: 'text',
      text: `Delivery: ${label}`,
      size: 'xs',
      color: '#6b7280',
    })
  }

  bodyContents.push(
    { type: 'separator', margin: 'sm' },
    ...order.items.map(itemRow),
    { type: 'separator', margin: 'sm' },
    totalRow(order.total),
  )

  return {
    type: 'bubble',
    size: 'kilo',
    header: orderHeader(order.id, order.status),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      paddingAll: '8px',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: 'Details',
            data: JSON.stringify({ action: 'ORDER_DETAILS', orderId: order.mongoId }),
            displayText: 'Loading order details…',
          },
        },
      ],
    },
    styles: {
      footer: { separator: true, separatorColor: '#e5e7eb' },
    },
  }
}

// ─── Order details bubble (reusable) ─────────────────────────────────────────

/**
 * Discriminated union of footer button shapes accepted by buildOrderDetailsBubble.
 * Lets callers compose any combination of postback / URI buttons without
 * leaking flex-message internals into service code.
 */
export type OrderActionButton =
  | {
      label: string
      kind: 'postback'
      data: string
      displayText?: string
      style?: 'primary' | 'secondary'
      color?: string
    }
  | {
      label: string
      kind: 'uri'
      uri: string
      style?: 'primary' | 'secondary'
      color?: string
    }

export interface OrderDetailsInput {
  orderShortId: string
  status: string
  items: OrderSummary['items']
  total: number
  /** When present, rendered as a tap-to-zoom hero image at the top. */
  imageUrl?: string
  /** Footer buttons; omit / pass [] for a button-less bubble. */
  actions?: OrderActionButton[]
}

/**
 * Reusable bubble for any "show me an order" intent — used by both the
 * payment-proof push (with proof image + Reject/Approve buttons) and the
 * "Details" postback handler from the active-orders carousel.
 */
export function buildOrderDetailsBubble(input: OrderDetailsInput): FlexBubble {
  const { orderShortId, status, items, total, imageUrl, actions = [] } = input

  const bodyContents: FlexComponent[] = []

  // Friendly amber sub-line when a payment is awaiting approval — implicit
  // call-to-action above the Reject/Approve buttons.
  if (status === 'pending_verification') {
    bodyContents.push({
      type: 'text',
      text: 'Customer has paid — awaiting your approval',
      size: 'xs',
      color: '#d97706',
      wrap: true,
    })
  }

  bodyContents.push(
    { type: 'separator', margin: 'md' },
    {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      margin: 'md',
      contents: items.map(itemRow),
    },
    { type: 'separator', margin: 'md' },
    totalRow(total),
  )

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: orderHeader(orderShortId, status),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '14px',
      contents: bodyContents,
    },
    styles: {
      body: { separator: true, separatorColor: '#e5e7eb' },
    },
  }

  if (imageUrl) {
    bubble.hero = {
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: '4:5',
      aspectMode: 'cover',
      action: { type: 'uri', label: 'View full image', uri: imageUrl },
    }
  }

  if (actions.length > 0) {
    bubble.footer = {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      paddingAll: '12px',
      contents: actions.map(toFlexButton),
    }
    bubble.styles = {
      ...bubble.styles,
      footer: { separator: true, separatorColor: '#e5e7eb' },
    }
  }

  return bubble
}

function toFlexButton(a: OrderActionButton): FlexComponent {
  const base = {
    type: 'button' as const,
    style: a.style ?? 'primary',
    height: 'sm' as const,
    ...(a.color ? { color: a.color } : {}),
  }
  if (a.kind === 'postback') {
    return {
      ...base,
      action: { type: 'postback', label: a.label, data: a.data, displayText: a.displayText },
    }
  }
  return {
    ...base,
    action: { type: 'uri', label: a.label, uri: a.uri },
  }
}

// ─── Carousel wrapper ────────────────────────────────────────────────────────

/** Wraps a list of bubbles into a carousel, or returns the single bubble directly. */
export function bubblesOrCarousel(bubbles: FlexBubble[]): FlexContainer {
  if (bubbles.length === 1) return bubbles[0]!
  return { type: 'carousel', contents: bubbles }
}
