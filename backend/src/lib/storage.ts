/**
 * Object storage abstraction.
 *
 * In production we use Cloudflare R2 (S3-compatible) for storing user-uploaded
 * payment-proof screenshots. The interface is generic enough that we can swap
 * to S3 / GCS / local filesystem later without touching call sites.
 *
 * Required env vars (R2):
 *   R2_ACCOUNT_ID         — Cloudflare account ID
 *   R2_ACCESS_KEY_ID      — R2 API token access key
 *   R2_SECRET_ACCESS_KEY  — R2 API token secret
 *   R2_BUCKET             — bucket name (e.g. agoda-food-uploads)
 *
 * If any of those are missing, we fall back to a local-filesystem storage
 * (writes under <repo>/.uploads/) so the app boots cleanly in dev without
 * cloud creds. Local storage is NOT durable across redeploys — set up R2
 * before going to production.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
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

// ---------------------------------------------------------------------------
// Cloudflare R2
// ---------------------------------------------------------------------------

class R2Storage implements Storage {
  private client: S3Client
  private bucket: string

  constructor(opts: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${opts.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
    })
    this.bucket = opts.bucket
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
}

// ---------------------------------------------------------------------------
// Local filesystem fallback (dev only)
// ---------------------------------------------------------------------------

class LocalFsStorage implements Storage {
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
    // Local mode: return a static path; the Express app serves this folder.
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
const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? ''
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? ''
const bucket = process.env.R2_BUCKET ?? ''

const hasR2 = Boolean(accountId && accessKeyId && secretAccessKey && bucket)

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), '..', '.uploads')
export const LOCAL_PUBLIC_PATH = '/uploads'

export const storage: Storage = hasR2
  ? new R2Storage({ accountId, accessKeyId, secretAccessKey, bucket })
  : new LocalFsStorage(LOCAL_UPLOAD_DIR, LOCAL_PUBLIC_PATH)

if (!hasR2) {
  console.warn(
    '[storage] R2 credentials missing — using local filesystem at ' +
      LOCAL_UPLOAD_DIR +
      '. Set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET for production.',
  )
}

export const isLocalStorage = !hasR2
