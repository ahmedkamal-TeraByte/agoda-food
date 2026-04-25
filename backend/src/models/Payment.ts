import { Schema, model, Document, Types } from 'mongoose'

export type PaymentProvider = 'mock' | 'stripe' | 'linepay'
export type PaymentDocStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'canceled' | 'refunded'

export interface IPayment extends Document {
  orderId: Types.ObjectId
  provider: PaymentProvider
  providerRef?: string
  amount: number
  currency: 'THB'
  status: PaymentDocStatus
  paidAt?: Date
  qrImageUrl?: string
  qrSvgUrl?: string
  qrData?: string
  expiresAt?: Date
  lastError?: string
  metadata?: { stripeEventId?: string }
  createdAt: Date
  updatedAt: Date
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    provider: { type: String, enum: ['mock', 'stripe', 'linepay'], required: true },
    providerRef: { type: String },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'THB' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'expired', 'canceled', 'refunded'],
      default: 'pending',
    },
    paidAt: { type: Date },
    qrImageUrl: { type: String },
    qrSvgUrl: { type: String },
    qrData: { type: String },
    expiresAt: { type: Date },
    lastError: { type: String },
    metadata: {
      type: new Schema({ stripeEventId: { type: String } }, { _id: false }),
    },
  },
  { timestamps: true },
)

PaymentSchema.index({ orderId: 1 })
// Unique-on-not-null: ensures retries find the same PI without duplicates
PaymentSchema.index({ providerRef: 1 }, { unique: true, sparse: true })

export const Payment = model<IPayment>('Payment', PaymentSchema)
