import { Schema, model, Document, Types } from 'mongoose'

export type OrderStatus =
  | 'awaiting_payment'
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'delivered'
  | 'cancelled'

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'

export interface IOrderItem {
  menuItemId: Types.ObjectId
  name: string
  price: number
  imageUrl?: string
  quantity: number
  note: string
}

export interface IOrder extends Document {
  userId: Types.ObjectId
  restaurantId: Types.ObjectId
  restaurantName: string
  items: IOrderItem[]
  subtotal: number
  deliveryFee: number
  total: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  serviceDate?: Date
  createdAt: Date
  updatedAt: Date
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String, default: '' },
  },
  { _id: false },
)

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    restaurantName: { type: String, required: true },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (v: IOrderItem[]) => Array.isArray(v) && v.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['awaiting_payment', 'pending', 'confirmed', 'preparing', 'delivered', 'cancelled'],
      default: 'awaiting_payment',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    serviceDate: { type: Date },
  },
  { timestamps: true },
)

OrderSchema.index({ userId: 1, createdAt: -1 })
OrderSchema.index({ restaurantId: 1, serviceDate: 1, status: 1 })
OrderSchema.index({ createdAt: -1 })

export const Order = model<IOrder>('Order', OrderSchema)
