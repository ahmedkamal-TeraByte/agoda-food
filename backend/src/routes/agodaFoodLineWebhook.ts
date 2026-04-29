import { Router } from 'express'
import express, { type Request, type Response } from 'express'
import crypto from 'crypto'
import { parseTextMessage } from '../lib/linePostback'
import { handleMyActiveOrders } from '../services/lineActiveOrders'

const router = Router()

const CHANNEL_SECRET = process.env.LINE_MESSAGING_CHANNEL_SECRET ?? ''

if (!CHANNEL_SECRET) {
  console.warn(
    '[lineWebhook] LINE_MESSAGING_CHANNEL_SECRET is not set — all inbound webhook requests will be rejected (401).',
  )
}

// ─── Minimal LINE event types ────────────────────────────────────────────────

interface LineEventSource {
  type?: string
  userId?: string
}

interface LineEvent {
  type: string
  replyToken?: string
  source?: LineEventSource
  message?: { type: string; id: string; text?: string }
}

interface LineWebhookBody {
  destination?: string
  events?: LineEvent[]
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(rawBody: Buffer, signature: string): boolean {
  if (!CHANNEL_SECRET) return false
  const expected = crypto
    .createHmac('sha256', CHANNEL_SECRET)
    .update(rawBody)
    .digest('base64')
  // timingSafeEqual requires buffers of equal byte length
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ─── Event dispatcher ────────────────────────────────────────────────────────

async function handleEvent(event: LineEvent): Promise<void> {
  // Only handle text message events (sent by rich-menu text actions)
  if (event.type !== 'message' || event.message?.type !== 'text') return

  const lineUserId = event.source?.userId
  const replyToken = event.replyToken
  if (!lineUserId || !replyToken) return

  const text = event.message.text ?? ''
  const parsed = parseTextMessage(text)
  if (!parsed) {
    console.debug('[lineWebhook] unrecognised text message, skipping:', text)
    return
  }

  switch (parsed.action) {
    case 'MY_ACTIVE_ORDERS':
      await handleMyActiveOrders({ lineUserId, replyToken })
      return
  }
}

// ─── Webhook route ────────────────────────────────────────────────────────────

/**
 * POST /api/line/webhook
 *
 * IMPORTANT: This route uses express.raw() and must be mounted BEFORE
 * express.json() in server.ts so the raw body buffer is available for
 * X-Line-Signature HMAC verification.
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response): void => {
    const signature = req.headers['x-line-signature']

    if (typeof signature !== 'string' || !verifySignature(req.body as Buffer, signature)) {
      res.status(401).end()
      return
    }

    let body: LineWebhookBody
    try {
      body = JSON.parse((req.body as Buffer).toString('utf8')) as LineWebhookBody
    } catch {
      res.status(400).end()
      return
    }

    // Acknowledge immediately — LINE retries if it doesn't get 2xx promptly.
    res.status(200).end()

    // Process events after responding so we never time out LINE's delivery window.
    for (const event of body.events ?? []) {
      handleEvent(event).catch((err: unknown) =>
        console.error('[lineWebhook] unhandled event error:', err),
      )
    }
  },
)

export default router
