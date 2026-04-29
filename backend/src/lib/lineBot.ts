/**
 * LINE Messaging API helpers — built on top of @line/bot-sdk v11.
 *
 * All push/reply functions are no-ops when LINE_MESSAGING_ACCESS_TOKEN is unset
 * so the app runs cleanly in local dev without bot credentials.
 *
 * Push  — proactive messages to a user (consumes monthly quota).
 * Reply — responses to webhook events via a one-time replyToken (free, ~30s TTL).
 */

import {
  messagingApi,
  middleware as lineMiddleware,
  SignatureValidationFailed,
} from '@line/bot-sdk'
import type { RequestHandler } from 'express'

const channelAccessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN ?? ''
const channelSecret = process.env.LINE_MESSAGING_CHANNEL_SECRET ?? ''

if (!channelSecret) {
  console.warn(
    '[lineBot] LINE_MESSAGING_CHANNEL_SECRET is not set — inbound webhook requests will be rejected (401).',
  )
}

const lineClient: messagingApi.MessagingApiClient | null = channelAccessToken
  ? new messagingApi.MessagingApiClient({ channelAccessToken })
  : null

// ─── Webhook middleware ──────────────────────────────────────────────────────

/**
 * Express middleware that verifies X-Line-Signature using the SDK and parses
 * the JSON body. Returns 401 on signature validation failure.
 *
 * MUST be mounted before app.use(express.json()) so the SDK can read the raw
 * body itself.
 */
export function lineWebhookMiddleware(): RequestHandler {
  if (!channelSecret) {
    return (_req, res) => {
      res.status(401).end()
    }
  }
  const inner = lineMiddleware({ channelSecret })
  return (req, res, next) => {
    inner(req as never, res as never, (err?: unknown) => {
      if (err) {
        if (err instanceof SignatureValidationFailed) {
          res.status(401).end()
          return
        }
        next(err as Error)
        return
      }
      next()
    })
  }
}

// ─── Push (server-initiated) ─────────────────────────────────────────────────

export async function pushText(lineUserId: string, text: string): Promise<void> {
  if (!lineClient || !lineUserId) return
  try {
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    })
  } catch (err) {
    console.error('[lineBot] pushText error:', err)
  }
}

export async function pushFlex(
  lineUserId: string,
  altText: string,
  contents: messagingApi.FlexContainer,
): Promise<void> {
  if (!lineClient || !lineUserId) return
  try {
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'flex', altText, contents }],
    })
  } catch (err) {
    console.error('[lineBot] pushFlex error:', err)
  }
}

// ─── Reply (in response to a webhook event) ──────────────────────────────────

export async function replyText(replyToken: string, text: string): Promise<void> {
  if (!lineClient || !replyToken) return
  try {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text }],
    })
  } catch (err) {
    console.error('[lineBot] replyText error:', err)
  }
}

export async function replyFlex(
  replyToken: string,
  altText: string,
  contents: messagingApi.FlexContainer,
): Promise<void> {
  if (!lineClient || !replyToken) return
  try {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'flex', altText, contents }],
    })
  } catch (err) {
    console.error('[lineBot] replyFlex error:', err)
  }
}

/**
 * Reply with a flex message followed by a plain-text message in the same
 * reply call. Used when we need an overflow hint after a carousel.
 * LINE allows up to 5 messages per reply.
 */
export async function replyFlexWithText(
  replyToken: string,
  altText: string,
  contents: messagingApi.FlexContainer,
  text: string,
): Promise<void> {
  if (!lineClient || !replyToken) return
  try {
    await lineClient.replyMessage({
      replyToken,
      messages: [
        { type: 'flex', altText, contents },
        { type: 'text', text },
      ],
    })
  } catch (err) {
    console.error('[lineBot] replyFlexWithText error:', err)
  }
}
