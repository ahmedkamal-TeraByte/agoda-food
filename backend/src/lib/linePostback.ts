import { z } from 'zod'

/**
 * Discriminated union of every postback action this bot handles.
 * Add a new z.object variant here to extend the bot with future actions.
 */
export const PostbackData = z.discriminatedUnion('action', [
  z.object({ action: z.literal('MY_ACTIVE_ORDERS') }),
])

export type PostbackData = z.infer<typeof PostbackData>

/**
 * Safely parses the raw postback data string (JSON) into a typed PostbackData.
 * Returns null for any unknown / malformed payloads so the webhook can skip
 * them silently.
 */
export function parsePostback(raw: string): PostbackData | null {
  try {
    return PostbackData.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * Maps a plain text message (sent by a rich-menu text action) to a typed action.
 * Comparison is case-insensitive and trims whitespace so button label casing
 * doesn't matter.
 * Returns null for unrecognised text so the webhook skips it silently.
 */
const TEXT_ACTION_MAP: Record<string, PostbackData['action']> = {
  'my active orders': 'MY_ACTIVE_ORDERS',
  'my orders': 'MY_ACTIVE_ORDERS',
}

export function parseTextMessage(text: string): PostbackData | null {
  const action = TEXT_ACTION_MAP[text.toLowerCase().trim()]
  if (!action) return null
  return { action }
}
