import { Schema, model, Document, Types } from "mongoose";

export type OrderStatus =
  | "awaiting_payment" // Customer has placed the order, has not paid yet
  | "pending_verification" // Customer uploaded payment proof, merchant has not reviewed
  | "pending" // Legacy / generic pending — kept for backward compat
  | "confirmed" // Merchant has confirmed payment
  | "preparing"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

export type PaymentProofStatus = "pending" | "verified" | "rejected";

export interface IOrderItem {
  menuItemId: Types.ObjectId;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  note: string;
}

/**
 * Embedded payment-proof record. We embed (rather than break out into its own
 * collection) because there's at most a handful of proof attempts per order
 * and the lifecycle is tightly coupled to the order.
 */
export interface IPaymentProof {
  fileKey: string; // Storage key (R2 or local fs)
  contentType: string; // image/jpeg, image/png, image/webp
  sizeBytes: number;
  uploadedAt: Date;
  status: PaymentProofStatus;
  reviewedAt?: Date;
  reviewerNote?: string; // Optional reason on rejection
}

export interface IOrder extends Document {
  userId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  restaurantName: string;
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProof?: IPaymentProof;
  serviceDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const PaymentProofSchema = new Schema<IPaymentProof>(
  {
    fileKey: { type: String, required: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    uploadedAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    reviewedAt: { type: Date },
    reviewerNote: { type: String },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    restaurantName: { type: String, required: true },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (v: IOrderItem[]) => Array.isArray(v) && v.length > 0,
        message: "Order must contain at least one item",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        "awaiting_payment",
        "pending_verification",
        "pending",
        "confirmed",
        "preparing",
        "delivered",
        "cancelled",
      ],
      default: "awaiting_payment",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    paymentProof: { type: PaymentProofSchema },
    serviceDate: { type: Date },
  },
  { timestamps: true },
);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, serviceDate: 1, status: 1 });
OrderSchema.index({ createdAt: -1 });

export const Order = model<IOrder>("Order", OrderSchema);
