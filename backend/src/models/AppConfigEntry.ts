import { Schema, model, Document } from 'mongoose'

export interface IAppConfigEntry extends Document {
  key: string
  value: string | number | boolean
  isSecret: boolean
  description?: string
  updatedAt: Date
}

const AppConfigEntrySchema = new Schema<IAppConfigEntry>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    isSecret: { type: Boolean, default: false },
    description: { type: String, trim: true },
  },
  { timestamps: true, collection: 'app_config' },
)

export const AppConfigEntry = model<IAppConfigEntry>('AppConfigEntry', AppConfigEntrySchema)
