import { Client, SendEmailV3_1, LibraryResponse } from 'node-mailjet'

const MAILJET_API_KEY = process.env.MAILJET_API_KEY ?? ''
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET ?? ''
const MAIL_FROM = process.env.MAIL_FROM ?? 'agodaminton@outlook.com'
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME ?? 'Agoda Food'
const MAIL_DISABLED = (process.env.MAIL_DISABLED ?? 'false').toLowerCase() === 'true'
const MAIL_SEND_TIMEOUT_MS = parseInt(process.env.MAIL_SEND_TIMEOUT_MS ?? '15000', 10)

let cachedClient: Client | null = null

function getClient(): Client {
  if (cachedClient) return cachedClient
  if (!MAILJET_API_KEY || !MAILJET_API_SECRET) {
    throw new Error('MAILJET_API_KEY / MAILJET_API_SECRET are not configured')
  }
  cachedClient = new Client({
    apiKey: MAILJET_API_KEY,
    apiSecret: MAILJET_API_SECRET,
    options: { timeout: MAIL_SEND_TIMEOUT_MS },
  })
  return cachedClient
}

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Sends an email via Mailjet's Send API v3.1 (shared Agodaminton account).
 * When MAIL_DISABLED=true we just log — handy for tests / offline dev.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  if (MAIL_DISABLED) {
    console.log(`[email:disabled] would send to=${to} subject="${subject}"`)
    return
  }

  const body: SendEmailV3_1.Body = {
    Messages: [
      {
        From: { Email: MAIL_FROM, Name: MAIL_FROM_NAME },
        To: [{ Email: to }],
        Subject: subject,
        HTMLPart: html,
        TextPart: text,
      },
    ],
  }

  try {
    const result: LibraryResponse<SendEmailV3_1.Response> = await getClient()
      .post('send', { version: 'v3.1' })
      .request(body)

    const status = result.body.Messages?.[0]?.Status
    console.log(`[email] sent to=${to} subject="${subject}" status=${status}`)
  } catch (err) {
    console.error(`[email] failed to send to=${to}:`, err)
    throw err
  }
}

/**
 * Sends a 6-digit OTP code to the recipient. The wording mirrors the
 * Agodaminton verification email so the template stays consistent.
 */
export async function sendOtpEmail(
  to: string,
  code: string,
  ttlMinutes: number,
  purpose: 'user_verify' | 'referral_verify',
): Promise<void> {
  const purposeLabel =
    purpose === 'referral_verify' ? 'referral verification' : 'email verification'

  const subject = `Agoda Food ${purposeLabel} code`
  const html = `
    <p>Hi,</p>
    <p>Your Agoda Food ${purposeLabel} code is:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
    <p>This code is valid for ${ttlMinutes} minutes. If you didn't request it, you can ignore this email.</p>
    <p>— Agoda Food</p>
  `
  const text = `Your Agoda Food ${purposeLabel} code is ${code}. It is valid for ${ttlMinutes} minutes.`

  await sendEmail({ to, subject, html, text })
}
