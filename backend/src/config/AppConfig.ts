import { AppConfigEntry } from '@models/AppConfigEntry'
import { CONFIG_KEYS, ConfigKey } from './keys'

class AppConfig {
  private static instance: AppConfig
  private values = new Map<string, unknown>()
  private loaded = false

  private constructor() {}

  static get(): AppConfig {
    if (!AppConfig.instance) AppConfig.instance = new AppConfig()
    return AppConfig.instance
  }

  async load(): Promise<void> {
    const rows = await AppConfigEntry.find({}).lean()
    for (const r of rows) this.values.set(r.key, r.value)

    for (const meta of Object.values(CONFIG_KEYS)) {
      if (!this.values.has(meta.key) && 'default' in meta) {
        this.values.set(meta.key, meta.default)
      }
    }

    const missing = Object.values(CONFIG_KEYS)
      .filter((meta) => meta.required && !this.values.has(meta.key))
      .map((meta) => meta.key)

    if (missing.length) {
      throw new Error(
        `[AppConfig] Missing required keys in the "app_config" Mongo collection: ${missing.join(', ')}.\n` +
          `Insert them via mongo shell, e.g.:\n` +
          `  db.app_config.insertOne({ key: "JWT_SECRET", value: "...", isSecret: true })`,
      )
    }

    this.loaded = true
    console.log('[AppConfig] Loaded', this.values.size, 'configuration entries')
  }

  // ─── Typed grouped accessors ──────────────────────────────────────────────

  line() {
    return {
      channelId: this.req<string>(CONFIG_KEYS.LINE_CHANNEL_ID.key),
      channelSecret: this.req<string>(CONFIG_KEYS.LINE_CHANNEL_SECRET.key),
      redirectUri: this.req<string>(CONFIG_KEYS.LINE_LOGIN_REDIRECT_URI.key),
    }
  }

  lineMessaging() {
    return {
      accessToken: this.opt<string>(CONFIG_KEYS.LINE_MESSAGING_ACCESS_TOKEN.key, ''),
      channelSecret: this.opt<string>(CONFIG_KEYS.LINE_MESSAGING_CHANNEL_SECRET.key, ''),
    }
  }

  liff() {
    return {
      id: this.req<string>(CONFIG_KEYS.LIFF_ID.key),
      publicAppUrl: this.opt<string>(CONFIG_KEYS.PUBLIC_APP_URL.key, ''),
    }
  }

  jwt() {
    return {
      secret: this.req<string>(CONFIG_KEYS.JWT_SECRET.key),
      expiresIn: this.opt<string>(CONFIG_KEYS.JWT_EXPIRES_IN.key, '7d'),
    }
  }

  otp() {
    return {
      ttlMinutes: this.opt<number>(CONFIG_KEYS.OTP_TTL_MINUTES.key, 10),
    }
  }

  email() {
    return {
      mailjetKey: this.opt<string>(CONFIG_KEYS.MAILJET_API_KEY.key, ''),
      mailjetSecret: this.opt<string>(CONFIG_KEYS.MAILJET_API_SECRET.key, ''),
      from: this.opt<string>(CONFIG_KEYS.MAIL_FROM.key, 'agodaminton@outlook.com'),
      fromName: this.opt<string>(CONFIG_KEYS.MAIL_FROM_NAME.key, 'Agoda Food'),
      disabled: this.opt<boolean>(CONFIG_KEYS.MAIL_DISABLED.key, false),
      timeoutMs: this.opt<number>(CONFIG_KEYS.MAIL_SEND_TIMEOUT_MS.key, 15000),
    }
  }

  r2() {
    return {
      accountId: this.opt<string>(CONFIG_KEYS.R2_ACCOUNT_ID.key, ''),
      private: {
        accessKeyId: this.opt<string>(CONFIG_KEYS.R2_ACCESS_KEY_ID.key, ''),
        secretAccessKey: this.opt<string>(CONFIG_KEYS.R2_SECRET_ACCESS_KEY.key, ''),
        bucket: this.opt<string>(CONFIG_KEYS.R2_BUCKET.key, ''),
      },
      public: {
        accessKeyId: this.opt<string>(CONFIG_KEYS.R2_PUBLIC_ACCESS_KEY_ID.key, ''),
        secretAccessKey: this.opt<string>(CONFIG_KEYS.R2_PUBLIC_SECRET_ACCESS_KEY.key, ''),
        bucket: this.opt<string>(CONFIG_KEYS.R2_PUBLIC_BUCKET.key, ''),
        baseUrl: this.opt<string>(CONFIG_KEYS.R2_PUBLIC_BASE_URL.key, '').replace(/\/$/, ''),
      },
    }
  }

  stripe() {
    return {
      secretKey: this.opt<string>(CONFIG_KEYS.STRIPE_SECRET_KEY.key, ''),
      webhookSecret: this.opt<string>(CONFIG_KEYS.STRIPE_WEBHOOK_SECRET.key, ''),
      statementDescriptor: this.opt<string>(CONFIG_KEYS.STRIPE_STATEMENT_DESCRIPTOR.key, 'AGODA FOOD').slice(0, 22),
      qrExpiryMinutes: this.opt<number>(CONFIG_KEYS.STRIPE_PROMPTPAY_QR_EXPIRY_MINUTES.key, 5),
    }
  }

  domain() {
    return {
      agodaEmailDomain: this.opt<string>(CONFIG_KEYS.AGODA_EMAIL_DOMAIN.key, 'agoda.com'),
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private req<T>(key: ConfigKey): T {
    if (!this.loaded) {
      throw new Error(`[AppConfig] config.load() has not been called yet (reading key: ${key})`)
    }
    const val = this.values.get(key)
    if (val === undefined || val === null || val === '') {
      throw new Error(`[AppConfig] Required key "${key}" is not set`)
    }
    return val as T
  }

  private opt<T>(key: ConfigKey, fallback: T): T {
    if (!this.loaded) {
      throw new Error(`[AppConfig] config.load() has not been called yet (reading key: ${key})`)
    }
    const val = this.values.get(key)
    if (val === undefined || val === null) return fallback
    return val as T
  }
}

export const config = AppConfig.get()
