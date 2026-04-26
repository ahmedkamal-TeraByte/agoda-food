/**
 * Multer upload middleware factory.
 *
 * Uploads are kept in memory (not on disk) — we re-encode them with sharp and
 * push the final bytes to R2 directly. Memory storage keeps the on-disk
 * footprint zero and avoids a tmp-file race on serverless platforms.
 */
import multer from 'multer'
import type { Request } from 'express'

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

/**
 * 8 MB upload cap — Thai bank screenshots are typically 200–600 KB, so this
 * is a wide-but-bounded ceiling that prevents abuse.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req: Request, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG, PNG, WebP or HEIC images are allowed'))
  },
})
