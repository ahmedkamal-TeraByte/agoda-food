interface KeyMeta {
  /** The string used as the primary key in the `app_config` Mongo collection. Must equal the property name. */
  key: string
  required: boolean
  secret: boolean
  default?: string | number | boolean
  description?: string
}

export const CONFIG_KEYS = {
  // LINE Login channel
  LINE_CHANNEL_ID: {
    key: 'LINE_CHANNEL_ID',
    required: true,
    secret: false,
    description: 'LINE Login channel ID (from LINE Developers Console)',
  },
  LINE_CHANNEL_SECRET: {
    key: 'LINE_CHANNEL_SECRET',
    required: true,
    secret: true,
    description: 'LINE Login channel secret',
  },
  LINE_LOGIN_REDIRECT_URI: {
    key: 'LINE_LOGIN_REDIRECT_URI',
    required: true,
    secret: false,
    description: 'Redirect URI registered on the LINE Login channel',
  },

  // LINE Messaging API
  LINE_MESSAGING_ACCESS_TOKEN: {
    key: 'LINE_MESSAGING_ACCESS_TOKEN',
    required: false,
    secret: true,
    description: 'LINE Messaging API channel access token (for push/reply)',
  },
  LINE_MESSAGING_CHANNEL_SECRET: {
    key: 'LINE_MESSAGING_CHANNEL_SECRET',
    required: false,
    secret: true,
    description: 'LINE Messaging API channel secret (for webhook HMAC verification)',
  },

  // LIFF
  LIFF_ID: {
    key: 'LIFF_ID',
    required: true,
    secret: false,
    description: 'LIFF app ID — used to build deep links into the merchant dashboard from LINE bot messages',
  },
  PUBLIC_APP_URL: {
    key: 'PUBLIC_APP_URL',
    required: false,
    secret: false,
    description: 'Public origin of the deployed app (no trailing slash)',
  },

  // JWT
  JWT_SECRET: {
    key: 'JWT_SECRET',
    required: true,
    secret: true,
    description: 'JWT session signing secret — use a long random string in production',
  },
  JWT_EXPIRES_IN: {
    key: 'JWT_EXPIRES_IN',
    required: false,
    secret: false,
    default: '7d',
    description: 'JWT session expiry (ms/zeit format — e.g. 7d, 24h)',
  },

  // OTP
  OTP_TTL_MINUTES: {
    key: 'OTP_TTL_MINUTES',
    required: false,
    secret: false,
    default: 10,
    description: 'OTP expiry in minutes',
  },

  // Domain
  AGODA_EMAIL_DOMAIN: {
    key: 'AGODA_EMAIL_DOMAIN',
    required: false,
    secret: false,
    default: 'agoda.com',
    description: 'Accepted Agoda email domain for restaurant referral verification',
  },

  // Cloudflare R2 — shared account ID
  R2_ACCOUNT_ID: {
    key: 'R2_ACCOUNT_ID',
    required: false,
    secret: false,
    description: 'Cloudflare account ID (shared between both R2 buckets)',
  },

  // R2 private bucket (payment proofs — signed-URL reads)
  R2_ACCESS_KEY_ID: {
    key: 'R2_ACCESS_KEY_ID',
    required: false,
    secret: true,
    description: 'R2 API token access key for the private bucket',
  },
  R2_SECRET_ACCESS_KEY: {
    key: 'R2_SECRET_ACCESS_KEY',
    required: false,
    secret: true,
    description: 'R2 API token secret for the private bucket',
  },
  R2_BUCKET: {
    key: 'R2_BUCKET',
    required: false,
    secret: false,
    description: 'R2 private bucket name',
  },

  // R2 public bucket (restaurant covers, logos, menu photos)
  R2_PUBLIC_ACCESS_KEY_ID: {
    key: 'R2_PUBLIC_ACCESS_KEY_ID',
    required: false,
    secret: true,
    description: 'R2 API token access key for the public bucket',
  },
  R2_PUBLIC_SECRET_ACCESS_KEY: {
    key: 'R2_PUBLIC_SECRET_ACCESS_KEY',
    required: false,
    secret: true,
    description: 'R2 API token secret for the public bucket',
  },
  R2_PUBLIC_BUCKET: {
    key: 'R2_PUBLIC_BUCKET',
    required: false,
    secret: false,
    description: 'R2 public bucket name',
  },
  R2_PUBLIC_BASE_URL: {
    key: 'R2_PUBLIC_BASE_URL',
    required: false,
    secret: false,
    description: 'Public read URL prefix for the R2 public bucket (no trailing slash)',
  },

  // Stripe
  STRIPE_SECRET_KEY: {
    key: 'STRIPE_SECRET_KEY',
    required: false,
    secret: true,
    description: 'Stripe secret key (sk_live_... or sk_test_...)',
  },
  STRIPE_WEBHOOK_SECRET: {
    key: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    secret: true,
    description: 'Stripe webhook endpoint signing secret (whsec_...)',
  },
  STRIPE_STATEMENT_DESCRIPTOR: {
    key: 'STRIPE_STATEMENT_DESCRIPTOR',
    required: false,
    secret: false,
    default: 'AGODA FOOD',
    description: 'Statement descriptor shown on card statements (max 22 chars)',
  },
  STRIPE_PROMPTPAY_QR_EXPIRY_MINUTES: {
    key: 'STRIPE_PROMPTPAY_QR_EXPIRY_MINUTES',
    required: false,
    secret: false,
    default: 5,
    description: 'Minutes until a PromptPay QR code expires',
  },

  // Mailjet / email
  MAILJET_API_KEY: {
    key: 'MAILJET_API_KEY',
    required: false,
    secret: true,
    description: 'Mailjet API key',
  },
  MAILJET_API_SECRET: {
    key: 'MAILJET_API_SECRET',
    required: false,
    secret: true,
    description: 'Mailjet API secret',
  },
  MAIL_FROM: {
    key: 'MAIL_FROM',
    required: false,
    secret: false,
    default: 'agodaminton@outlook.com',
    description: 'Sender email address',
  },
  MAIL_FROM_NAME: {
    key: 'MAIL_FROM_NAME',
    required: false,
    secret: false,
    default: 'Agoda Food',
    description: 'Sender display name',
  },
  MAIL_DISABLED: {
    key: 'MAIL_DISABLED',
    required: false,
    secret: false,
    default: false,
    description: 'When true, emails are logged but not sent (useful for dev/tests)',
  },
  MAIL_SEND_TIMEOUT_MS: {
    key: 'MAIL_SEND_TIMEOUT_MS',
    required: false,
    secret: false,
    default: 15000,
    description: 'Mailjet send timeout in milliseconds',
  },
} as const satisfies Record<string, KeyMeta>

export type ConfigKey = keyof typeof CONFIG_KEYS

// Sanity check: each entry's `key` field must match its property name.
// Catches typos at module load (during import), before any config-dependent
// code runs. Throws if mismatched.
for (const [propName, meta] of Object.entries(CONFIG_KEYS)) {
  if (meta.key !== propName) {
    throw new Error(
      `[CONFIG_KEYS] property "${propName}" has key="${meta.key}" — they must match`,
    )
  }
}
