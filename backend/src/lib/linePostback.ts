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
