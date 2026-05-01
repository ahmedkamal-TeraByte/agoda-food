/**
 * Payment provider abstraction.
 *
 * Default: StripePromptPayProvider when STRIPE_SECRET_KEY is set, otherwise
 * MockPaymentProvider (for offline/no-Stripe development).
 *
 * Local Stripe webhook setup:
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *
 * Test PromptPay:
 *   - Use a test secret key (sk_test_...).
 *   - Trigger payment success: stripe trigger payment_intent.succeeded
 *     (or use Stripe Dashboard → Payment Intents → confirm a test PI)
 */
import { IOrder } from '@models/Order'
import { Payment } from '@models/Payment'
import { User } from '@models/User'
import { getStripe, getStatementDescriptor, getQrExpiryMinutes } from './stripe'
import { config } from '@config/AppConfig'

export type PromptPayStatus = 'pending' | 'paid' | 'expired' | 'failed'

export interface PromptPayQR {
  paymentIntentId: string
  qrImageUrl: string
  qrSvgUrl: string
  qrData: string
  expiresAt: Date
  amount: number      // satang (THB × 100)
  currency: 'thb'
  status: PromptPayStatus
}

export interface PaymentProvider {
  name: 'mock' | 'stripe'
  createPromptPayPayment(order: IOrder): Promise<PromptPayQR>
  retrievePromptPayPayment(paymentIntentId: string): Promise<PromptPayQR>
}

// ---------------------------------------------------------------------------
// Stripe PromptPay provider
// ---------------------------------------------------------------------------

export class StripePromptPayProvider implements PaymentProvider {
  name = 'stripe' as const

  async createPromptPayPayment(order: IOrder): Promise<PromptPayQR> {
    const amount = Math.round(order.total * 100) // THB → satang
    const qrExpiryMinutes = getQrExpiryMinutes()
    const expiresAt = new Date(Date.now() + qrExpiryMinutes * 60_000)

    // Time-binned idempotency key: all retries within the same QR window map to
    // the same Stripe PI, preventing duplicate charges on double-click.
    const windowIndex = Math.floor(Date.now() / (qrExpiryMinutes * 60_000))
    const idempotencyKey = `order_${order._id}_${windowIndex}`

    // Stripe requires billing_details.email for PromptPay
    const user = await User.findById(order.userId)
    const email = user?.email ?? `order-${order._id}@agoda-food.local`

    const pi = await getStripe().paymentIntents.create(
      {
        amount,
        currency: 'thb',
        payment_method_data: {
          type: 'promptpay',
          billing_details: { email },
        },
        payment_method_types: ['promptpay'],
        confirm: true,
        statement_descriptor: getStatementDescriptor(),
        description: `Order ${order._id} — ${order.restaurantName}`,
        metadata: {
          orderId: order._id.toString(),
          userId: order.userId.toString(),
          restaurantId: order.restaurantId.toString(),
        },
      },
      { idempotencyKey },
    )

    if (pi.status !== 'requires_action' || pi.next_action?.type !== 'promptpay_display_qr_code') {
      throw new Error(`Unexpected PaymentIntent status: ${pi.status}`)
    }

    const qrCode = pi.next_action.promptpay_display_qr_code!
    const qrImageUrl = qrCode.image_url_png ?? ''
    const qrSvgUrl = qrCode.image_url_svg ?? ''
    const qrData = qrCode.data ?? ''

    // Upsert the Payment doc (handles idempotent retries gracefully)
    await Payment.findOneAndUpdate(
      { providerRef: pi.id },
      {
        orderId: order._id,
        provider: 'stripe',
        providerRef: pi.id,
        amount: order.total,
        currency: 'THB',
        status: 'pending',
        qrImageUrl,
        qrSvgUrl,
        qrData,
        expiresAt,
      },
      { upsert: true, new: true },
    )

    return { paymentIntentId: pi.id, qrImageUrl, qrSvgUrl, qrData, expiresAt, amount, currency: 'thb', status: 'pending' }
  }

  async retrievePromptPayPayment(piId: string): Promise<PromptPayQR> {
    const pi = await getStripe().paymentIntents.retrieve(piId)

    if (pi.status === 'succeeded') {
      return { paymentIntentId: pi.id, qrImageUrl: '', qrSvgUrl: '', qrData: '', expiresAt: new Date(0), amount: pi.amount, currency: 'thb', status: 'paid' }
    }

    if (pi.status === 'canceled') {
      return { paymentIntentId: pi.id, qrImageUrl: '', qrSvgUrl: '', qrData: '', expiresAt: new Date(0), amount: pi.amount, currency: 'thb', status: 'expired' }
    }

    if (pi.status === 'requires_action' && pi.next_action?.type === 'promptpay_display_qr_code') {
      const qrCode = pi.next_action.promptpay_display_qr_code!
      const payment = await Payment.findOne({ providerRef: pi.id })
      return {
        paymentIntentId: pi.id,
        qrImageUrl: qrCode.image_url_png ?? '',
        qrSvgUrl: qrCode.image_url_svg ?? '',
        qrData: qrCode.data ?? '',
        expiresAt: payment?.expiresAt ?? new Date(0),
        amount: pi.amount,
        currency: 'thb',
        status: 'pending',
      }
    }

    return { paymentIntentId: pi.id, qrImageUrl: '', qrSvgUrl: '', qrData: '', expiresAt: new Date(0), amount: pi.amount, currency: 'thb', status: 'failed' }
  }
}

// ---------------------------------------------------------------------------
// Mock provider — used when STRIPE_SECRET_KEY is not set (local dev without Stripe)
// Returns a PromptPayQR-shaped response so the frontend code path is uniform.
// ---------------------------------------------------------------------------

const MOCK_QR_IMAGE = '/mock-qr.png' // served from frontend/public/mock-qr.png

export class MockPaymentProvider implements PaymentProvider {
  name = 'mock' as const

  async createPromptPayPayment(order: IOrder): Promise<PromptPayQR> {
    const ref = `mock_${order._id}_${Date.now()}`
    const expiresAt = new Date(Date.now() + getQrExpiryMinutes() * 60_000)

    await Payment.findOneAndUpdate(
      { providerRef: ref },
      {
        orderId: order._id,
        provider: 'mock',
        providerRef: ref,
        amount: order.total,
        currency: 'THB',
        status: 'pending',
        qrImageUrl: MOCK_QR_IMAGE,
        qrSvgUrl: MOCK_QR_IMAGE,
        qrData: 'mock-qr-data',
        expiresAt,
      },
      { upsert: true, new: true },
    )

    return {
      paymentIntentId: ref,
      qrImageUrl: MOCK_QR_IMAGE,
      qrSvgUrl: MOCK_QR_IMAGE,
      qrData: 'mock-qr-data',
      expiresAt,
      amount: Math.round(order.total * 100),
      currency: 'thb',
      status: 'pending',
    }
  }

  async retrievePromptPayPayment(piId: string): Promise<PromptPayQR> {
    const payment = await Payment.findOne({ providerRef: piId })
    const status: PromptPayStatus =
      payment?.status === 'paid' || payment?.status === 'expired' || payment?.status === 'failed'
        ? payment.status
        : 'pending'
    return {
      paymentIntentId: piId,
      qrImageUrl: MOCK_QR_IMAGE,
      qrSvgUrl: MOCK_QR_IMAGE,
      qrData: 'mock-qr-data',
      expiresAt: payment?.expiresAt ?? new Date(0),
      amount: (payment?.amount ?? 0) * 100,
      currency: 'thb',
      status,
    }
  }
}

// ---------------------------------------------------------------------------
// Lazy provider factory
// ---------------------------------------------------------------------------

let cachedProvider: PaymentProvider | null = null

export function getDefaultProvider(): PaymentProvider {
  if (cachedProvider) return cachedProvider
  cachedProvider = config.stripe().secretKey
    ? new StripePromptPayProvider()
    : new MockPaymentProvider()
  return cachedProvider
}
