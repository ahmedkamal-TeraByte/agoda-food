import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.warn('[stripe] STRIPE_SECRET_KEY not set; Stripe payments will fail at runtime.')
}

export const stripe = new Stripe(key ?? 'sk_test_missing', {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
  appInfo: { name: 'agoda-food', version: '0.1.0' },
})

export const STATEMENT_DESCRIPTOR = (process.env.STRIPE_STATEMENT_DESCRIPTOR ?? 'AGODA FOOD').slice(0, 22)
export const QR_EXPIRY_MINUTES = Number(process.env.STRIPE_PROMPTPAY_QR_EXPIRY_MINUTES ?? 5)
