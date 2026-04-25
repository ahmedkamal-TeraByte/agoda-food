import bcrypt from 'bcryptjs'
import { OtpCode, OtpPurpose } from '../models/OtpCode'

const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES ?? '10', 10)
const MAX_ATTEMPTS = 3

/**
 * Generates a 6-digit OTP for the given email + purpose, invalidates any prior
 * unused OTPs for that pair, and returns the plaintext code so the caller can
 * log it to the console (dev) or send it via email (prod).
 */
export async function generateOtp(email: string, purpose: OtpPurpose): Promise<string> {
  // Invalidate any prior unconsumed OTPs for this email+purpose
  await OtpCode.deleteMany({ email: email.toLowerCase(), purpose, consumedAt: null })

  const code = Math.floor(100_000 + Math.random() * 900_000).toString()
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

  await OtpCode.create({ email: email.toLowerCase(), codeHash, purpose, expiresAt, attempts: 0 })

  console.log(`[OTP] ${purpose} for ${email}: ${code} (expires in ${OTP_TTL_MINUTES}min)`)
  return code
}

/**
 * Returns true if the code is valid and marks it consumed.
 * Returns false if expired, already used, or too many attempts.
 */
export async function verifyOtp(
  email: string,
  purpose: OtpPurpose,
  code: string,
): Promise<boolean> {
  const otp = await OtpCode.findOne({
    email: email.toLowerCase(),
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  })

  if (!otp) return false

  otp.attempts += 1

  if (otp.attempts >= MAX_ATTEMPTS) {
    await otp.deleteOne()
    return false
  }

  const valid = await bcrypt.compare(code, otp.codeHash)
  if (valid) {
    otp.consumedAt = new Date()
    await otp.save()
    return true
  }

  await otp.save()
  return false
}
