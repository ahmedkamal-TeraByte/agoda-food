import { Router, Request, Response, NextFunction } from 'express'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { Order } from '@models/Order'
import { Restaurant } from '@models/Restaurant'
import { MenuItem } from '@models/MenuItem'
import { Payment } from '@models/Payment'
import { requireUser, requireMerchant } from '@middleware/auth'
import { getServiceDate } from '@lib/orderWindow'
import { renderQrDataUrl } from '@lib/promptPay'
import { getPrivateStorage, getPublicStorage } from '@lib/storage'
import { imageUpload } from '@lib/upload'
import { pushText } from '@lib/lineBot'
import { pushPaymentProofToMerchant } from '@services/linePaymentReview'

/**
 * How long we keep a payment-proof screenshot in object storage after its
 * lifecycle terminates (rejected, canceled, or paid). After this window a
 * cleanup job removes the file from R2 and stamps `fileDeletedAt`.
 */
const PROOF_FILE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

const router = Router()

interface OrderItemInput {
  menuItemId: string
  quantity: number
  note?: string
}

interface CreateOrderBody {
  restaurantId: string
  items: OrderItemInput[]
}

// POST /api/orders — authenticated
router.post(
  '/',
  requireUser,
  async (req: Request<object, object, CreateOrderBody>, res: Response) => {
    const { restaurantId, items } = req.body
    const user = req.user!

    if (!user.emailVerified) {
      res.status(409).json({
        error: 'Please verify your email before placing an order',
        code: 'EMAIL_VERIFICATION_REQUIRED',
      })
      return
    }

    if (!restaurantId || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'restaurantId and at least one item are required' })
      return
    }

    try {
      const restaurant = await Restaurant.findById(restaurantId)
      if (!restaurant) {
        res.status(404).json({ error: 'Restaurant not found' })
        return
      }
      if (restaurant.status !== 'active' || !restaurant.isOpen) {
        res.status(400).json({ error: 'Restaurant is not accepting orders' })
        return
      }
      // Restaurant must have a PromptPay QR configured for the BYO-QR flow,
      // otherwise the customer can't pay.
      if (!restaurant.promptPayPayload) {
        res.status(409).json({
          error: 'Restaurant has not set up payment yet. Please try again later.',
          code: 'PAYMENT_NOT_CONFIGURED',
        })
        return
      }

      const serviceDate = getServiceDate(restaurant.orderWindow, new Date())
      if (!serviceDate) {
        res.status(409).json({
          error: 'Ordering is currently closed for this restaurant',
          code: 'ORDER_WINDOW_CLOSED',
        })
        return
      }

      const menuItemIds = items.map((i) => i.menuItemId)
      const menuItems = await MenuItem.find({
        _id: { $in: menuItemIds },
        restaurantId,
        isAvailable: true,
      })
      const menuItemMap = new Map(menuItems.map((m) => [m._id.toString(), m]))

      const resolvedItems = []
      for (const input of items) {
        const menuItem = menuItemMap.get(input.menuItemId)
        if (!menuItem) {
          res.status(400).json({ error: `Menu item ${input.menuItemId} not available for this restaurant` })
          return
        }
        if (!Number.isInteger(input.quantity) || input.quantity < 1) {
          res.status(400).json({ error: `Quantity must be a positive integer for ${menuItem.name}` })
          return
        }
        resolvedItems.push({
          menuItemId: menuItem._id,
          name: menuItem.name,
          price: menuItem.price,
          imageUrl: menuItem.imageKey
            ? getPublicStorage().publicUrl(menuItem.imageKey)
            : undefined,
          quantity: input.quantity,
          note: input.note ?? '',
        })
      }

      const subtotal = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
      const deliveryFee = restaurant.deliveryFee
      const total = subtotal + deliveryFee

      if (subtotal < restaurant.minOrder) {
        res.status(400).json({
          error: `Order subtotal ฿${subtotal} is below the minimum order ฿${restaurant.minOrder}`,
        })
        return
      }

      const order = await Order.create({
        userId: user._id,
        restaurantId: restaurant._id,
        restaurantName: restaurant.name,
        items: resolvedItems,
        subtotal,
        deliveryFee,
        total,
        status: 'awaiting_payment',
        paymentStatus: 'unpaid',
        serviceDate,
      })

      res.status(201).json(order.toObject())
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to create order' })
    }
  },
)

/**
 * Helper — load the order if the requester owns it; respond 4xx otherwise.
 */
async function loadOwnedOrder(req: Request, res: Response) {
  const order = await Order.findById(req.params.id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return null
  }
  if (order.userId.toString() !== req.user!._id.toString()) {
    res.status(403).json({ error: 'You do not have access to this order' })
    return null
  }
  return order
}

interface PromptPayPaymentResponse {
  qrImageUrl: string         // PNG data URL re-rendered from the merchant payload
  qrPayload: string          // Raw EMV string (informational; UI can ignore)
  amount: number             // satang (THB × 100)
  currency: 'thb'
  paymentStatus: 'unpaid' | 'paid' | 'refunded'
  proofStatus?: 'pending' | 'verified' | 'rejected'
  proofUploadedAt?: Date
}

// POST /api/orders/:id/pay — generates a fresh PromptPay QR (rendered from
// the restaurant's stored EMV payload). Customers re-call this any time
// the page is reloaded; it has no side effects.
router.post('/:id/pay', requireUser, async (req: Request, res: Response) => {
  try {
    const order = await loadOwnedOrder(req, res)
    if (!order) return
    if (order.paymentStatus === 'paid') {
      res.status(409).json({ error: 'Order is already paid' })
      return
    }
    if (order.status === 'cancelled') {
      res.status(409).json({ error: 'Order has been cancelled' })
      return
    }

    const restaurant = await Restaurant.findById(order.restaurantId)
    if (!restaurant?.promptPayPayload) {
      res.status(409).json({
        error: 'Restaurant has not configured PromptPay payment',
        code: 'PAYMENT_NOT_CONFIGURED',
      })
      return
    }

    const qrImageUrl = await renderQrDataUrl(restaurant.promptPayPayload)
    const response: PromptPayPaymentResponse = {
      qrImageUrl,
      qrPayload: restaurant.promptPayPayload,
      amount: Math.round(order.total * 100),
      currency: 'thb',
      paymentStatus: order.paymentStatus,
      proofStatus: order.paymentProof?.status,
      proofUploadedAt: order.paymentProof?.uploadedAt,
    }
    res.json(response)
  } catch (err) {
    console.error('[orders] pay failed', err)
    res.status(500).json({ error: 'Failed to generate payment QR' })
  }
})

// GET /api/orders/:id/payment — same shape as /pay but with no side effects.
// Used by the order page on reload.
router.get('/:id/payment', requireUser, async (req: Request, res: Response) => {
  try {
    const order = await loadOwnedOrder(req, res)
    if (!order) return
    const restaurant = await Restaurant.findById(order.restaurantId)
    if (!restaurant?.promptPayPayload) {
      res.status(404).json({ error: 'No payment configured' })
      return
    }
    const qrImageUrl = await renderQrDataUrl(restaurant.promptPayPayload)
    const response: PromptPayPaymentResponse = {
      qrImageUrl,
      qrPayload: restaurant.promptPayPayload,
      amount: Math.round(order.total * 100),
      currency: 'thb',
      paymentStatus: order.paymentStatus,
      proofStatus: order.paymentProof?.status,
      proofUploadedAt: order.paymentProof?.uploadedAt,
    }
    res.json(response)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch payment session' })
  }
})

// POST /api/orders/:id/payment-proof — multipart upload of the screenshot.
// Customer-only. Re-encodes via sharp (strips EXIF, normalises orientation,
// caps dimensions), pushes to R2, transitions order to pending_verification.
router.post(
  '/:id/payment-proof',
  requireUser,
  imageUpload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const order = await loadOwnedOrder(req, res)
      if (!order) return
      if (order.paymentStatus === 'paid') {
        res.status(409).json({ error: 'Order is already paid' })
        return
      }
      if (order.status !== 'awaiting_payment') {
        res.status(409).json({ error: 'Order is not awaiting payment' })
        return
      }
      if (!req.file) {
        res.status(400).json({ error: 'image file is required' })
        return
      }

      // Re-encode the upload through sharp. This (a) strips EXIF metadata,
      // (b) normalises orientation, (c) caps the long side at 1600px and
      // recompresses to JPEG quality 85 — keeps file size predictable and
      // throws away any device fingerprinting baked into the original file.
      const processed = await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()

      const fileKey = `payment-proofs/${order._id}/${randomUUID()}.jpg`
      await getPrivateStorage().put(fileKey, processed, 'image/jpeg')

      // Append a new audit row for this attempt. Prior attempts (if any)
      // stay in the collection with their existing status — the cleanup cron
      // unlinks their files after `expireFileAt`.
      const now = new Date()
      await Payment.create({
        orderId: order._id,
        provider: 'promptpay_byo',
        amount: order.total,
        currency: 'THB',
        status: 'pending',
        fileKey,
        contentType: 'image/jpeg',
        sizeBytes: processed.length,
        expireFileAt: new Date(now.getTime() + PROOF_FILE_RETENTION_MS),
      })

      // Denormalised "latest attempt" snapshot — what the customer-facing UI
      // reads. Source of truth lives in the Payment collection above.
      order.paymentProof = {
        fileKey,
        contentType: 'image/jpeg',
        sizeBytes: processed.length,
        uploadedAt: now,
        status: 'pending',
      }
      order.status = 'pending_verification'
      await order.save()

      // Notify the merchant via LINE (best-effort; never blocks the response).
      pushPaymentProofToMerchant(order).catch((err) =>
        console.error('[orders] pushPaymentProofToMerchant failed:', err),
      )

      res.json(order.toObject())
    } catch (err) {
      console.error('[orders] payment-proof upload failed', err)
      res.status(500).json({ error: 'Failed to upload payment proof' })
    }
  },
)

// POST /api/orders/:id/cancel — customer-only, only while awaiting payment
// or pending verification. Cleans up any uploaded proof file.
router.post('/:id/cancel', requireUser, async (req: Request, res: Response) => {
  try {
    const order = await loadOwnedOrder(req, res)
    if (!order) return

    const cancellable: typeof order.status[] = ['awaiting_payment', 'pending_verification']
    if (!cancellable.includes(order.status)) {
      res.status(409).json({ error: 'This order can no longer be cancelled' })
      return
    }

    // If there's an in-flight upload, mark the corresponding Payment row as
    // `canceled` so the audit log reflects what happened. The actual file
    // stays in storage for the retention window — a future cleanup job
    // unlinks it via `expireFileAt`. We also clear the denormalised snapshot
    // on the order so the customer's UI doesn't keep showing the proof.
    if (order.paymentProof?.fileKey) {
      const now = new Date()
      await Payment.updateOne(
        {
          orderId: order._id,
          provider: 'promptpay_byo',
          fileKey: order.paymentProof.fileKey,
          status: 'pending',
        },
        {
          $set: {
            status: 'canceled',
            reviewedAt: now,
            expireFileAt: new Date(now.getTime() + PROOF_FILE_RETENTION_MS),
          },
        },
      )
      order.paymentProof = undefined
    }
    order.status = 'cancelled'
    await order.save()

    res.json(order)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to cancel order' })
  }
})

// PATCH /api/orders/:id/status — merchant-only, must own the restaurant
router.patch('/:id/status', requireMerchant, async (req: Request, res: Response) => {
  const { status } = req.body as { status?: string }
  const allowed = ['confirmed', 'preparing', 'in_delivery', 'delivered', 'cancelled'] as const
  type AllowedStatus = (typeof allowed)[number]

  if (!status || !allowed.includes(status as AllowedStatus)) {
    res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` })
    return
  }

  try {
    const order = await Order.findById(req.params.id).populate('restaurantId')
    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }

    const restaurant = await Restaurant.findById(order.restaurantId)
    if (!restaurant || restaurant.ownerUserId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'You do not own this restaurant' })
      return
    }

    order.status = status as AllowedStatus
    await order.save()

    if (status === 'in_delivery') {
      const customer = await import('@models/User').then((m) => m.User.findById(order.userId))
      if (customer?.lineUserId) {
        await pushText(
          customer.lineUserId,
          `🛵 Your order from ${order.restaurantName} is on its way! It'll be at reception shortly.`,
        )
      }
    }

    if (status === 'delivered') {
      const customer = await import('@models/User').then((m) => m.User.findById(order.userId))
      if (customer?.lineUserId) {
        await pushText(
          customer.lineUserId,
          `🍱 Your order from ${order.restaurantName} has been delivered! Pick it up at reception.`,
        )
      }
    }

    res.json(order)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update order status' })
  }
})

// GET /api/orders/:id — authenticated, owner-only
router.get('/:id', requireUser, async (req: Request, res: Response) => {
  try {
    const order = await loadOwnedOrder(req, res)
    if (!order) return
    res.json(order)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' })
  }
})

// Multer / sharp error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code
    if (code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File is too large (max 8 MB)' })
      return
    }
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message })
    return
  }
  res.status(500).json({ error: 'Upload failed' })
})

export default router
