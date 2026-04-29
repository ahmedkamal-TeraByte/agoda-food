/**
 * LINE Messaging API push and reply helpers.
 * All functions are no-ops when LINE_MESSAGING_ACCESS_TOKEN is unset so the
 * app runs cleanly in local dev without bot credentials.
 *
 * Push  — proactive messages to a user (consumes monthly quota).
 * Reply — responses to webhook events via a one-time replyToken (free, ~30 s TTL).
 */

const ACCESS_TOKEN = process.env.LINE_MESSAGING_ACCESS_TOKEN ?? ''
const PUSH_URL = 'https://api.line.me/v2/bot/message/push'
const REPLY_URL = 'https://api.line.me/v2/bot/message/reply'

// ─── Push ────────────────────────────────────────────────────────────────────

async function push(lineUserId: string, messages: object[]): Promise<void> {
  if (!ACCESS_TOKEN || !lineUserId) return

  try {
    const res = await fetch(PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: lineUserId, messages }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[lineBot] push failed (${res.status}): ${body}`)
    }
  } catch (err) {
    console.error('[lineBot] push error:', err)
  }
}

export async function pushText(lineUserId: string, text: string): Promise<void> {
  await push(lineUserId, [{ type: 'text', text }])
}

export async function pushFlex(
  lineUserId: string,
  altText: string,
  flex: object,
): Promise<void> {
  await push(lineUserId, [{ type: 'flex', altText, contents: flex }])
}

// ─── Reply ───────────────────────────────────────────────────────────────────

async function reply(replyToken: string, messages: object[]): Promise<void> {
  if (!ACCESS_TOKEN || !replyToken) return

  try {
    const res = await fetch(REPLY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[lineBot] reply failed (${res.status}): ${body}`)
    }
  } catch (err) {
    console.error('[lineBot] reply error:', err)
  }
}

export async function replyText(replyToken: string, text: string): Promise<void> {
  await reply(replyToken, [{ type: 'text', text }])
}

export async function replyFlex(
  replyToken: string,
  altText: string,
  flex: object,
): Promise<void> {
  await reply(replyToken, [{ type: 'flex', altText, contents: flex }])
}

/**
 * Reply with a flex message followed by a plain text message in the same
 * reply call. Used when we need to append an overflow hint after the carousel.
 * LINE allows up to 5 messages per reply.
 */
export async function replyFlexWithText(
  replyToken: string,
  altText: string,
  flex: object,
  text: string,
): Promise<void> {
  await reply(replyToken, [
    { type: 'flex', altText, contents: flex },
    { type: 'text', text },
  ])
}
