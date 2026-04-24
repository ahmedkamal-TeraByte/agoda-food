import { Schema, model, Document, Types } from 'mongoose'

export interface IDish extends Document {
  restaurantId: Types.ObjectId
  name: string
  description: string
  price: number // THB
  imageUrl: string
  category: string
  isPopular: boolean
  isVegetarian: boolean
  // Soft-disable a dish without deleting it (e.g. 86'd for the day).
  // Orders can still reference disabled dishes; new orders cannot add them.
  isAvailable: boolean
  createdAt: Date
  updatedAt: Date
}

const DishSchema = new Schema<IDish>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: true },
    category: { type: String, required: true },
    isPopular: { type: Boolean, default: false },
    isVegetarian: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true },
)

// Primary access pattern: fetch the menu of a restaurant grouped by category.
DishSchema.index({ restaurantId: 1, category: 1 })
DishSchema.index({ restaurantId: 1, isAvailable: 1 })

export const Dish = model<IDish>('Dish', DishSchema)
