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
 * Required env vars (R2):
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
 *
 * If any of those are missing, we fall back to a local-filesystem storage
 * (writes under <repo>/.uploads/) so the app boots cleanly in dev without
 * cloud creds. Local storage is NOT durable across redeploys.
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
// Factory
// ---------------------------------------------------------------------------

const accountId = process.env.R2_ACCOUNT_ID ?? ''

// Private bucket
const privateAccessKeyId = process.env.R2_ACCESS_KEY_ID ?? ''
const privateSecretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? ''
const privateBucket = process.env.R2_BUCKET ?? ''
const hasPrivateR2 = Boolean(
  accountId && privateAccessKeyId && privateSecretAccessKey && privateBucket,
)

// Public bucket
const publicAccessKeyId = process.env.R2_PUBLIC_ACCESS_KEY_ID ?? ''
const publicSecretAccessKey = process.env.R2_PUBLIC_SECRET_ACCESS_KEY ?? ''
const publicBucket = process.env.R2_PUBLIC_BUCKET ?? ''
const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')
const hasPublicR2 = Boolean(
  accountId &&
    publicAccessKeyId &&
    publicSecretAccessKey &&
    publicBucket &&
    publicBaseUrl,
)

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), '..', '.uploads')
export const LOCAL_PUBLIC_PATH = '/uploads'

const localFs = new LocalFsStorage(LOCAL_UPLOAD_DIR, LOCAL_PUBLIC_PATH)

export const privateStorage: Storage = hasPrivateR2
  ? new R2Storage({
      accountId,
      accessKeyId: privateAccessKeyId,
      secretAccessKey: privateSecretAccessKey,
      bucket: privateBucket,
    })
  : localFs

export const publicStorage: PublicStorage = hasPublicR2
  ? new R2Storage({
      accountId,
      accessKeyId: publicAccessKeyId,
      secretAccessKey: publicSecretAccessKey,
      bucket: publicBucket,
      publicBaseUrl,
    })
  : localFs

if (!hasPrivateR2) {
  console.warn(
    '[storage] private R2 credentials missing — using local filesystem at ' +
      LOCAL_UPLOAD_DIR +
      '. Set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET for production.',
  )
}
if (!hasPublicR2) {
  console.warn(
    '[storage] public R2 credentials missing — using local filesystem at ' +
      LOCAL_UPLOAD_DIR +
      '. Set R2_PUBLIC_ACCESS_KEY_ID / R2_PUBLIC_SECRET_ACCESS_KEY / R2_PUBLIC_BUCKET / R2_PUBLIC_BASE_URL for production.',
  )
}

export const isLocalStorage = !hasPrivateR2 || !hasPublicR2
