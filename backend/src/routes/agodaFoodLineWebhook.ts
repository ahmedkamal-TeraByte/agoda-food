import { Router, type Request, type Response } from 'express'
import type { webhook } from '@line/bot-sdk'
import { lineWebhookMiddleware } from '@lib/lineBot'
import { parseTextMessage, parsePostback } from '@lib/linePostback'
import { handleMyActiveOrders } from '@services/lineActiveOrders'
import { handleApprovePayment } from '@services/linePaymentReview'
import { handleOrderDetails } from '@services/lineOrderDetails'

const router = Router()

// ─── Event dispatcher ────────────────────────────────────────────────────────

async function handleEvent(event: webhook.Event): Promise<void> {
  if (event.type === 'message' && event.message.type === 'text') {
    await handleTextMessage(event, event.message.text)
    return
  }
  if (event.type === 'postback') {
    await handlePostback(event)
    return
  }
}

async function handleTextMessage(
  event: webhook.MessageEvent,
  text: string,
): Promise<void> {
  const lineUserId = event.source?.userId
  const replyToken = event.replyToken
  if (!lineUserId || !replyToken) return

  const parsed = parseTextMessage(text)
  if (!parsed) {
    console.debug('[lineWebhook] unrecognised text message, skipping:', text)
    return
  }

  switch (parsed.action) {
    case 'MY_ACTIVE_ORDERS':
      await handleMyActiveOrders({ lineUserId, replyToken })
      return
    // Other actions (e.g. APPROVE_PAYMENT) only arrive via postback, never text.
    default:
      return
  }
}

async function handlePostback(event: webhook.PostbackEvent): Promise<void> {
  const lineUserId = event.source?.userId
  const replyToken = event.replyToken
  if (!lineUserId || !replyToken) return

  const parsed = parsePostback(event.postback.data)
  if (!parsed) {
    console.debug('[lineWebhook] unknown postback, skipping:', event.postback.data)
    return
  }

  switch (parsed.action) {
    case 'APPROVE_PAYMENT':
      await handleApprovePayment({ orderId: parsed.orderId, lineUserId, replyToken })
      return
    case 'ORDER_DETAILS':
      await handleOrderDetails({ orderId: parsed.orderId, lineUserId, replyToken })
      return
    case 'MY_ACTIVE_ORDERS':
      await handleMyActiveOrders({ lineUserId, replyToken })
      return
  }
}

// ─── Webhook route ────────────────────────────────────────────────────────────

/**
 * POST /api/line/webhook
 *
 * IMPORTANT: lineWebhookMiddleware() reads the raw body for HMAC verification,
 * so this router MUST be mounted before app.use(express.json()) in server.ts.
 */
router.post('/webhook', lineWebhookMiddleware(), (req: Request, res: Response): void => {
  // The SDK middleware has already verified the signature and parsed JSON.
  const body = req.body as webhook.CallbackRequest
  const events = body.events ?? []

  // Acknowledge immediately — LINE retries if it doesn't get 2xx promptly.
  res.status(200).end()

  // Process events after responding so we never time out LINE's delivery window.
  for (const event of events) {
    handleEvent(event).catch((err: unknown) =>
      console.error('[lineWebhook] unhandled event error:', err),
    )
  }
})

export default router
