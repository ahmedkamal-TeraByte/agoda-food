/**
 * LINE Messaging API push helpers.
 * All functions are no-ops when LINE_MESSAGING_ACCESS_TOKEN is unset so the
 * app runs cleanly in local dev without bot credentials.
 */

const ACCESS_TOKEN = process.env.LINE_MESSAGING_ACCESS_TOKEN ?? ''
const PUSH_URL = 'https://api.line.me/v2/bot/message/push'

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
