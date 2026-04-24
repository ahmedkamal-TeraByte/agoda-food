import { Schema, model, Document } from 'mongoose'

export interface IRestaurant extends Document {
  name: string
  cuisine: string
  // rating and reviewCount are denormalised aggregates. When a Review collection
  // is introduced, they become computed/cached fields instead of user-written.
  rating: number
  reviewCount: number
  deliveryTime: string
  deliveryFee: number
  minOrder: number
  imageUrl: string
  logoUrl: string
  tags: string[]
  isOpen: boolean
  createdAt: Date
  updatedAt: Date
}

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
    isOpen: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

export const Restaurant = model<IRestaurant>('Restaurant', RestaurantSchema)
