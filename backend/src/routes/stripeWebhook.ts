import { Router, Request, Response } from 'express'
import express from 'express'
import { getStripe } from '@lib/stripe'
import { Order } from '@models/Order'
import { Payment } from '@models/Payment'
import { User } from '@models/User'
import { pushText } from '@lib/lineBot'
import { config } from '@config/AppConfig'

const router = Router()

// Infer the event type from Stripe's constructEvent return value so we stay
// compatible across Stripe SDK major versions without relying on the namespace.
type StripeEvent = ReturnType<ReturnType<typeof getStripe>['webhooks']['constructEvent']>

// IMPORTANT: This route uses express.raw() for raw body parsing so Stripe can
// verify the webhook signature. It MUST be mounted in server.ts BEFORE
// app.use(express.json()), otherwise the body will be pre-parsed as JSON and
// signature verification will fail with a 400.
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature']
    const secret = config.stripe().webhookSecret

    if (!sig || !secret) {
      res.status(400).send('Missing Stripe signature or webhook secret')
      return
    }

    let event: StripeEvent
    try {
      event = getStripe().webhooks.constructEvent(req.body, sig, secret)
    } catch (err) {
      console.error('[stripe webhook] signature verification failed:', err)
      res.status(400).send('Invalid signature')
      return
    }

    // Idempotency: skip events we've already processed
    const alreadyHandled = await Payment.findOne({ 'metadata.stripeEventId': event.id })
    if (alreadyHandled) {
      res.json({ received: true, duplicate: true })
      return
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handleSucceeded(event)
          break
        case 'payment_intent.payment_failed':
          await handleFailed(event)
          break
        case 'payment_intent.canceled':
          await handleCanceled(event)
          break
        default:
          // Acknowledge and ignore unrelated event types
          break
      }
      res.json({ received: true })
    } catch (err) {
      console.error('[stripe webhook] handler error:', err)
      // Return 500 so Stripe retries with exponential backoff
      res.status(500).send('Handler error')
    }
  },
)

async function handleSucceeded(event: StripeEvent) {
  const pi = event.data.object as {
    id: string
    amount: number
    metadata?: Record<string, string>
  }
  const orderId = pi.metadata?.orderId
  if (!orderId) {
    console.warn(`[stripe webhook] payment_intent.succeeded missing orderId in metadata (PI: ${pi.id})`)
    return
  }

  const order = await Order.findById(orderId)
  if (!order) {
    console.warn(`[stripe webhook] order ${orderId} not found for PI ${pi.id}`)
    return
  }

  // Guard: only update if not already paid (webhook can fire multiple times)
  if (order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid'
    order.status = 'confirmed'
    await order.save()
  }

  await Payment.findOneAndUpdate(
    { providerRef: pi.id },
    {
      status: 'paid',
      paidAt: new Date(),
      'metadata.stripeEventId': event.id,
    },
  )

  // LINE push notification (no-op if token unset)
  const customer = await User.findById(order.userId)
  if (customer?.lineUserId) {
    const serviceDateStr = order.serviceDate
      ? order.serviceDate.toLocaleDateString('en-GB', {
          timeZone: 'Asia/Bangkok',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : 'today'
    await pushText(
      customer.lineUserId,
      `✅ Order confirmed! Your lunch from ${order.restaurantName} will be delivered on ${serviceDateStr}.`,
    )
  }
}

async function handleFailed(event: StripeEvent) {
  const pi = event.data.object as {
    id: string
    last_payment_error?: { message?: string }
  }
  await Payment.findOneAndUpdate(
    { providerRef: pi.id },
    {
      status: 'failed',
      lastError: pi.last_payment_error?.message ?? 'Payment failed',
      'metadata.stripeEventId': event.id,
    },
  )
  // Order stays in 'awaiting_payment' so the customer can retry.
}

async function handleCanceled(event: StripeEvent) {
  const pi = event.data.object as { id: string }
  await Payment.findOneAndUpdate(
    { providerRef: pi.id },
    {
      status: 'expired',
      'metadata.stripeEventId': event.id,
    },
  )
}

export default router
