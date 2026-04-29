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
  id: string
  restaurantName: string
  status: string
  items: { name: string; quantity: number; price: number }[]
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
  return {
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
  }
}

// ─── Carousel wrapper ────────────────────────────────────────────────────────

/** Wraps a list of bubbles into a carousel, or returns the single bubble directly. */
export function bubblesOrCarousel(bubbles: FlexBubble[]): FlexContainer {
  if (bubbles.length === 1) return bubbles[0]!
  return { type: 'carousel', contents: bubbles }
}
