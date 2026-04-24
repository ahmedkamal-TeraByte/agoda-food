import { Schema, model, Document, Types } from 'mongoose'

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled'

/**
 * OrderItem snapshots dish data at order time. The dishId reference is kept for
 * analytics (e.g. "top-selling dishes"), but name/price/imageUrl are frozen so
 * the order stays historically accurate even if the dish is later edited or deleted.
 */
export interface IOrderItem {
  dishId: Types.ObjectId
  name: string
  price: number
  imageUrl: string
  quantity: number
  note: string
}

export interface IOrder extends Document {
  restaurantId: Types.ObjectId
  restaurantName: string
  items: IOrderItem[]
  subtotal: number
  deliveryFee: number
  total: number
  status: OrderStatus
  createdAt: Date
  updatedAt: Date
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    dishId: { type: Schema.Types.ObjectId, ref: 'Dish', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String, default: '' },
  },
  { _id: false },
)

const OrderSchema = new Schema<IOrder>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
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
      enum: ['pending', 'confirmed', 'preparing', 'delivered', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true },
)

// Common operational queries
OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 })
OrderSchema.index({ createdAt: -1 })

export const Order = model<IOrder>('Order', OrderSchema)
