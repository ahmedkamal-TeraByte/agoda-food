import { Schema, model, Document, Types } from "mongoose";

/**
 * `Payment` is a polymorphic audit log of every payment *attempt* against an
 * order. Two providers are stored here today:
 *
 *  - `stripe` / `mock` — the legacy Stripe PromptPay flow. One PI per order
 *    (idempotency-keyed). Carries Stripe-specific fields like `qrImageUrl`,
 *    `qrSvgUrl`, `qrData`, `expiresAt`, `metadata.stripeEventId`.
 *
 *  - `promptpay_byo` — the current "bring your own QR" flow. Each *uploaded
 *    screenshot* gets its own row. Carries proof-specific fields: `fileKey`,
 *    `contentType`, `sizeBytes`, `reviewedAt`, `reviewerNote`, plus
 *    `expireFileAt` / `fileDeletedAt` for the 30-day file lifecycle.
 *
 * Status semantics by provider:
 *
 *  Stripe:        pending → paid | failed | expired | canceled | refunded
 *  PromptPay BYO: pending → paid (verified) | rejected | canceled
 *
 * `Order.paymentProof` is a *denormalised snapshot* of the most-recent BYO
 * attempt; this collection is the source of truth for full history.
 */

export type PaymentProvider = "mock" | "stripe" | "linepay" | "promptpay_byo";
export type PaymentDocStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "canceled"
  | "refunded"
  | "rejected";

export interface IPayment extends Document {
  orderId: Types.ObjectId;
  provider: PaymentProvider;
  providerRef?: string;
  amount: number;
  currency: "THB";
  status: PaymentDocStatus;
  paidAt?: Date;

  // ── Stripe-specific ─────────────────────────────────────────────────────
  qrImageUrl?: string;
  qrSvgUrl?: string;
  qrData?: string;
  expiresAt?: Date;
  metadata?: { stripeEventId?: string };

  // ── PromptPay BYO proof-specific ────────────────────────────────────────
  /** Storage key (R2 / local fs) of the uploaded screenshot. */
  fileKey?: string;
  contentType?: string;
  sizeBytes?: number;
  /** When the merchant confirmed/rejected this attempt. */
  reviewedAt?: Date;
  /** Free-text reason the merchant gave when rejecting. */
  reviewerNote?: string;
  /**
   * When the screenshot file should be removed from object storage. Set on
   * upload (now + 30d) and refreshed on review (now + 30d). A future cleanup
   * cron scans `{ provider: 'promptpay_byo', fileKey: { $ne: null },
   * fileDeletedAt: null, expireFileAt: { $lte: now } }` and unlinks the file.
   */
  expireFileAt?: Date;
  /** Set by the cleanup job after the file has been removed from storage. */
  fileDeletedAt?: Date;

  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    provider: {
      type: String,
      enum: ["mock", "stripe", "linepay", "promptpay_byo"],
      required: true,
    },
    providerRef: { type: String },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "THB" },
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "failed",
        "expired",
        "canceled",
        "refunded",
        "rejected",
      ],
      default: "pending",
    },
    paidAt: { type: Date },

    qrImageUrl: { type: String },
    qrSvgUrl: { type: String },
    qrData: { type: String },
    expiresAt: { type: Date },
    metadata: {
      type: new Schema({ stripeEventId: { type: String } }, { _id: false }),
    },

    fileKey: { type: String },
    contentType: { type: String },
    sizeBytes: { type: Number, min: 0 },
    reviewedAt: { type: Date },
    reviewerNote: { type: String },
    expireFileAt: { type: Date },
    fileDeletedAt: { type: Date },

    lastError: { type: String },
  },
  { timestamps: true },
);

PaymentSchema.index({ orderId: 1, createdAt: -1 });
// Unique-on-not-null: ensures Stripe retries find the same PI without duplicates.
PaymentSchema.index({ providerRef: 1 }, { unique: true, sparse: true });
// Cleanup job: find BYO files whose retention window has elapsed and that
// haven't been deleted yet.
PaymentSchema.index(
  { provider: 1, expireFileAt: 1 },
  {
    partialFilterExpression: { provider: "promptpay_byo", fileDeletedAt: null },
  },
);

export const Payment = model<IPayment>("Payment", PaymentSchema);
