import { Schema, model, Document } from 'mongoose'

export type OtpPurpose = 'user_verify' | 'referral_verify'

export interface IOtpCode extends Document {
  email: string
  codeHash: string
  purpose: OtpPurpose
  expiresAt: Date
  consumedAt?: Date
  attempts: number
}

const OtpCodeSchema = new Schema<IOtpCode>({
  email: { type: String, required: true, lowercase: true, trim: true },
  codeHash: { type: String, required: true },
  purpose: { type: String, enum: ['user_verify', 'referral_verify'], required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date },
  attempts: { type: Number, default: 0 },
})

// MongoDB TTL index: automatically deletes expired OTP docs from the collection
OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
OtpCodeSchema.index({ email: 1, purpose: 1 })

export const OtpCode = model<IOtpCode>('OtpCode', OtpCodeSchema)
