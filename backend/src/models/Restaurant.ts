import { Schema, model, Document, Types } from 'mongoose'

export type RestaurantStatus = 'draft' | 'active' | 'suspended'

export interface IOrderWindow {
  openHour: number
  closeHour: number
  deliveryHour: number
}

export interface IReferral {
  name: string
  email: string
  verifiedAt?: Date
}

export interface IRestaurant extends Document {
  name: string
  cuisine: string
  rating: number
  reviewCount: number
  deliveryTime: string
  deliveryFee: number
  minOrder: number
  imageUrl: string
  logoUrl: string
  tags: string[]
  categories: string[]
  isOpen: boolean
  ownerUserId: Types.ObjectId
  orderWindow: IOrderWindow
  referral?: IReferral
  status: RestaurantStatus
  /**
   * EMV TLV payload string decoded from the merchant's uploaded PromptPay QR.
   * We re-render the QR at order time from this string. Empty string means
   * the merchant has not set up payment yet (orders cannot be placed).
   */
  promptPayPayload?: string
  createdAt: Date
  updatedAt: Date
}

const OrderWindowSchema = new Schema<IOrderWindow>(
  {
    openHour: { type: Number, default: 17, min: 0, max: 23 },
    closeHour: { type: Number, default: 10, min: 0, max: 23 },
    deliveryHour: { type: Number, default: 12, min: 0, max: 23 },
  },
  { _id: false },
)

const ReferralSchema = new Schema<IReferral>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    verifiedAt: { type: Date },
  },
  { _id: false },
)

const RestaurantSchema = new Schema<IRestaurant>(
  {
    name: { type: String, required: true, index: true },
    cuisine: { type: String, required: true },
    rating: { type: Number, required: true, min: 0, max: 5 },
    reviewCount: { type: Number, required: true, default: 0, min: 0 },
    deliveryTime: { type: String, required: true },
    deliveryFee: { type: Number, required: true, default: 0, min: 0 },
    minOrder: { type: Number, required: true, default: 0, min: 0 },
    imageUrl: { type: String, required: true },
    logoUrl: { type: String, required: true },
    tags: [{ type: String }],
    categories: { type: [String], default: [] },
    isOpen: { type: Boolean, required: true, default: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderWindow: { type: OrderWindowSchema, default: () => ({}) },
    referral: { type: ReferralSchema },
    status: {
      type: String,
      enum: ['draft', 'active', 'suspended'],
      default: 'active',
    },
    promptPayPayload: { type: String, default: '' },
  },
  { timestamps: true },
)

RestaurantSchema.index({ status: 1 })

export const Restaurant = model<IRestaurant>('Restaurant', RestaurantSchema)
