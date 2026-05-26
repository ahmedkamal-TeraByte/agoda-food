/**
 * Object storage abstraction.
 *
 * We run TWO storage instances in parallel:
 *
 *   * `privateStorage` — payment-proof screenshots. Bucket is private; reads
 *     happen through short-lived signed URLs (~5 min) issued by the backend.
 *   * `publicStorage`  — restaurant covers, logos, menu item photos. Bucket
 *     has public read enabled on Cloudflare; the browser fetches images
 *     directly from `R2_PUBLIC_BASE_URL/<key>` with no API call.
 *
 * Each bucket has its own scoped R2 API token, so a leaked credential on one
 * path can't touch the other.
 *
 * Storage selection policy:
 *
 *   * `NODE_ENV !== 'production'`  — ALWAYS use the local filesystem (under
 *     `<repo>/.uploads/`). R2 credentials are ignored even if present, so
 *     dev runs never touch the cloud bucket and never burn quota.
 *   * `NODE_ENV === 'production'`  — use R2 when all required keys for that
 *     bucket are configured; otherwise fall back to the same local-fs path
 *     (with a warning). Local storage is NOT durable across redeploys.
 *
 * Required config keys for R2 (set in the `app_config` Mongo collection):
 *   R2_ACCOUNT_ID                — Cloudflare account ID (shared)
 *
 *   # private bucket
 *   R2_ACCESS_KEY_ID             — token access key for the private bucket
 *   R2_SECRET_ACCESS_KEY         — token secret for the private bucket
 *   R2_BUCKET                    — private bucket name
 *
 *   # public bucket
 *   R2_PUBLIC_ACCESS_KEY_ID      — token access key for the public bucket
 *   R2_PUBLIC_SECRET_ACCESS_KEY  — token secret for the public bucket
 *   R2_PUBLIC_BUCKET             — public bucket name
 *   R2_PUBLIC_BASE_URL           — public read URL prefix (no trailing /)
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface Storage {
  /** Upload a file. Returns the storage key. */
  put(key: string, body: Buffer, contentType: string): Promise<string>
  /** Generate a short-lived URL the browser can use to fetch the file. */
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>
  /** Delete a file. Best-effort; missing keys do not throw. */
  delete(key: string): Promise<void>
}

/**
 * A storage that ALSO supports stable, unauthenticated public URLs.
 * Distinct type so that calling `publicUrl()` on the private bucket is a
 * compile-time error.
 */
export interface PublicStorage extends Storage {
  /** Stable absolute URL the browser can embed in `<img src>`. */
  publicUrl(key: string): string
}

// ---------------------------------------------------------------------------
// Cloudflare R2
// ---------------------------------------------------------------------------

interface R2StorageOpts {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  /** When set, `publicUrl()` returns `${publicBaseUrl}/<key>`. */
  publicBaseUrl?: string
}

class R2Storage implements PublicStorage {
  private client: S3Client
  private bucket: string
  private publicBaseUrl?: string

  constructor(opts: R2StorageOpts) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${opts.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
    })
    this.bucket = opts.bucket
    this.publicBaseUrl = opts.publicBaseUrl
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
    return key
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    )
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (err) {
      console.warn('[storage] delete failed for', key, err)
    }
  }

  publicUrl(key: string): string {
    if (!this.publicBaseUrl) {
      throw new Error(
        'publicUrl() called on an R2 storage without R2_PUBLIC_BASE_URL configured',
      )
    }
    return `${this.publicBaseUrl}/${key}`
  }
}

// ---------------------------------------------------------------------------
// Local filesystem fallback (dev only)
// ---------------------------------------------------------------------------

class LocalFsStorage implements PublicStorage {
  private root: string
  private publicBase: string

  constructor(root: string, publicBase: string) {
    this.root = root
    this.publicBase = publicBase
  }

  private resolve(key: string): string {
    // Prevent path traversal: keys must not escape root
    const full = path.resolve(this.root, key)
    if (!full.startsWith(path.resolve(this.root))) {
      throw new Error('Invalid storage key')
    }
    return full
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<string> {
    const full = this.resolve(key)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, body)
    return key
  }

  async getSignedUrl(key: string, _ttlSeconds: number): Promise<string> {
    return `${this.publicBase}/${key}`
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key))
    } catch (err: unknown) {
      // ENOENT is fine — file already gone
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn('[storage] delete failed for', key, err)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Factory (lazy — initialised after config.load() runs at startup)
// ---------------------------------------------------------------------------
import { config } from '@config/AppConfig'

// Resolved from this module's location (not process.cwd()) so the path is the
// same whether the server is launched from the repo root, the backend
// workspace, or via the compiled dist build:
//   backend/src/lib/storage.ts   → ../../../.uploads = <repo>/.uploads
//   backend/dist/lib/storage.js  → ../../../.uploads = <repo>/.uploads
export const LOCAL_UPLOAD_DIR = path.resolve(__dirname, '..', '..', '..', '.uploads')
export const LOCAL_PUBLIC_PATH = '/uploads'

const IS_PROD = process.env.NODE_ENV === 'production'

const localFs = new LocalFsStorage(LOCAL_UPLOAD_DIR, LOCAL_PUBLIC_PATH)

let cachedPrivate: Storage | null = null
let cachedPublic: PublicStorage | null = null

export function getPrivateStorage(): Storage {
  if (cachedPrivate) return cachedPrivate

  if (!IS_PROD) {
    console.warn(
      '[storage] non-production env — private storage forced to local filesystem at ' +
        LOCAL_UPLOAD_DIR,
    )
    cachedPrivate = localFs
    return cachedPrivate
  }

  const r2 = config.r2()
  const { accountId } = r2
  const { accessKeyId, secretAccessKey, bucket } = r2.private
  const hasR2 = Boolean(accountId && accessKeyId && secretAccessKey && bucket)

  if (!hasR2) {
    console.warn(
      '[storage] private R2 credentials missing — using local filesystem at ' +
        LOCAL_UPLOAD_DIR +
        '. Set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET for production.',
    )
    cachedPrivate = localFs
  } else {
    cachedPrivate = new R2Storage({ accountId, accessKeyId, secretAccessKey, bucket })
  }

  return cachedPrivate
}

export function getPublicStorage(): PublicStorage {
  if (cachedPublic) return cachedPublic

  if (!IS_PROD) {
    console.warn(
      '[storage] non-production env — public storage forced to local filesystem at ' +
        LOCAL_UPLOAD_DIR,
    )
    cachedPublic = localFs
    return cachedPublic
  }

  const r2 = config.r2()
  const { accountId } = r2
  const { accessKeyId, secretAccessKey, bucket, baseUrl } = r2.public
  const hasR2 = Boolean(accountId && accessKeyId && secretAccessKey && bucket && baseUrl)

  if (!hasR2) {
    console.warn(
      '[storage] public R2 credentials missing — using local filesystem at ' +
        LOCAL_UPLOAD_DIR +
        '. Set R2_PUBLIC_ACCESS_KEY_ID / R2_PUBLIC_SECRET_ACCESS_KEY / R2_PUBLIC_BUCKET / R2_PUBLIC_BASE_URL for production.',
    )
    cachedPublic = localFs
  } else {
    cachedPublic = new R2Storage({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicBaseUrl: baseUrl,
    })
  }

  return cachedPublic
}

export function getIsLocalStorage(): boolean {
  // Non-prod ALWAYS uses local storage, regardless of whether R2 creds exist.
  if (!IS_PROD) return true

  const r2 = config.r2()
  const { accountId } = r2
  const { accessKeyId: privKey, secretAccessKey: privSecret, bucket: privBucket } = r2.private
  const { accessKeyId: pubKey, secretAccessKey: pubSecret, bucket: pubBucket, baseUrl } = r2.public

  const hasPrivate = Boolean(accountId && privKey && privSecret && privBucket)
  const hasPublic = Boolean(accountId && pubKey && pubSecret && pubBucket && baseUrl)

  return !hasPrivate || !hasPublic
}
