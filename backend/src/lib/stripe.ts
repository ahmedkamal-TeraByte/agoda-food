import Stripe from 'stripe'
import { config } from '@config/AppConfig'

let cachedStripe: InstanceType<typeof Stripe> | null = null

export function getStripe(): InstanceType<typeof Stripe> {
  if (cachedStripe) return cachedStripe
  const { secretKey } = config.stripe()
  if (!secretKey) {
    console.warn('[stripe] STRIPE_SECRET_KEY not set; Stripe payments will fail at runtime.')
  }
  cachedStripe = new Stripe(secretKey || 'sk_test_missing', {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    appInfo: { name: 'agoda-food', version: '0.1.0' },
  })
  return cachedStripe
}

export function getStatementDescriptor(): string {
  return config.stripe().statementDescriptor
}

export function getQrExpiryMinutes(): number {
  return config.stripe().qrExpiryMinutes
}
