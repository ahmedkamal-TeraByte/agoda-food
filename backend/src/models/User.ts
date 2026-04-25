import { Schema, model, Document } from 'mongoose'

export type UserRole = 'customer' | 'merchant' | 'admin'

export interface IUser extends Document {
  lineUserId?: string
  displayName: string
  email?: string
  phone?: string
  pictureUrl?: string
  deliveryLocation?: string
  role: UserRole
  emailVerified: boolean
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
      sparse: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: { type: String, trim: true },
    pictureUrl: { type: String },
    deliveryLocation: { type: String, trim: true },
    role: {
      type: String,
      enum: ['customer', 'merchant', 'admin'],
      default: 'customer',
    },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export const User = model<IUser>('User', UserSchema)
