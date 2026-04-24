import { Schema, model, Document } from 'mongoose'

export interface IUser extends Document {
  lineUserId?: string
  displayName: string
  email?: string   // optional until the user completes onboarding
  phone?: string   // optional until the user completes onboarding
  pictureUrl?: string
  deliveryLocation?: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    lineUserId: {
      type: String,
      unique: true,
      sparse: true,
    },
    displayName: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true, // nulls don't collide; still unique when present
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: { type: String, trim: true },
    pictureUrl: { type: String },
    deliveryLocation: { type: String, trim: true },
  },
  { timestamps: true },
)

export const User = model<IUser>('User', UserSchema)
