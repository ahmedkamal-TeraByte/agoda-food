import { Router, Request, Response } from 'express'
import { Order } from '../models/Order'
import { Restaurant } from '../models/Restaurant'
import { MenuItem } from '../models/MenuItem'
import { Payment } from '../models/Payment'
import { requireUser, requireMerchant } from '../middleware/auth'
import { getServiceDate } from '../lib/orderWindow'
import { defaultProvider } from '../lib/payment'
import { stripe } from '../lib/stripe'
import { pushText } from '../lib/lineBot'

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

    // Email verification gate (opt-in via env var)
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
      if (restaurant.status !== 'active') {
        res.status(400).json({ error: 'Restaurant is not accepting orders' })
        return
      }
      if (!restaurant.isOpen) {
        res.status(400).json({ error: 'Restaurant is not accepting orders' })
        return
      }

      // Order window check
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
          imageUrl: menuItem.imageUrl,
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

// POST /api/orders/:id/pay — authenticated, order-owner only
// Returns PromptPayQR data for the frontend to render.
// Order is marked paid ONLY by the Stripe webhook (stripeWebhook.ts).
router.post('/:id/pay', requireUser, async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }
    if (order.userId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'You do not have access to this order' })
      return
    }
    if (order.paymentStatus === 'paid') {
      res.status(409).json({ error: 'Order is already paid' })
      return
    }

    // Re-use an existing non-expired pending payment session (handles page reload
    // and double-click without creating duplicate PaymentIntents on Stripe).
    const existingPayment = await Payment.findOne({ orderId: order._id, status: 'pending' })
    if (
      existingPayment &&
      existingPayment.expiresAt &&
      existingPayment.expiresAt > new Date() &&
      existingPayment.providerRef &&
      existingPayment.qrImageUrl
    ) {
      res.json({
        paymentIntentId: existingPayment.providerRef,
        qrImageUrl: existingPayment.qrImageUrl,
        qrSvgUrl: existingPayment.qrSvgUrl,
        qrData: existingPayment.qrData,
        expiresAt: existingPayment.expiresAt,
        amount: Math.round(order.total * 100),
        currency: 'thb',
        status: 'pending',
      })
      return
    }

    // Create a new PromptPay PaymentIntent via the active provider
    const qr = await defaultProvider.createPromptPayPayment(order)
    res.json(qr)
  } catch (err) {
    console.error('[orders] createPromptPayPayment failed', err)
    res.status(502).json({ error: 'Failed to create PromptPay payment. Please try again.' })
  }
})

// GET /api/orders/:id/payment — returns the most recent payment session for an order.
// Used by the order page on reload to restore QR without creating a new PaymentIntent.
router.get('/:id/payment', requireUser, async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }
    if (order.userId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'You do not have access to this order' })
      return
    }

    const payment = await Payment.findOne({ orderId: order._id }).sort({ createdAt: -1 })
    if (!payment || !payment.providerRef) {
      res.status(404).json({ error: 'No payment session found' })
      return
    }

    res.json({
      paymentIntentId: payment.providerRef,
      qrImageUrl: payment.qrImageUrl,
      qrSvgUrl: payment.qrSvgUrl,
      qrData: payment.qrData,
      expiresAt: payment.expiresAt,
      status: payment.status,
      amount: Math.round(order.total * 100),
      currency: 'thb',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch payment session' })
  }
})

// POST /api/orders/:id/cancel — customer-only, only while awaiting payment.
// Marks the order cancelled and cancels any pending Stripe PaymentIntent so
// the QR becomes invalid and Stripe stops waiting on it.
router.post('/:id/cancel', requireUser, async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }
    if (order.userId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'You do not have access to this order' })
      return
    }
    if (order.status !== 'awaiting_payment') {
      res.status(409).json({ error: 'Only orders awaiting payment can be cancelled by the customer' })
      return
    }

    // Cancel any pending Stripe PaymentIntent (best-effort; webhook will also
    // catch this and set payment.status='expired')
    const pendingPayment = await Payment.findOne({ orderId: order._id, status: 'pending' })
    if (pendingPayment?.providerRef && pendingPayment.provider === 'stripe') {
      try {
        await stripe.paymentIntents.cancel(pendingPayment.providerRef)
      } catch (err) {
        console.warn('[orders] failed to cancel Stripe PI on order cancel:', err)
      }
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
  const allowed = ['confirmed', 'preparing', 'delivered', 'cancelled'] as const
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

    // Verify the merchant owns the restaurant the order belongs to
    const restaurant = await Restaurant.findById(order.restaurantId)
    if (!restaurant || restaurant.ownerUserId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'You do not own this restaurant' })
      return
    }

    order.status = status as AllowedStatus
    await order.save()

    // Push delivery notification to customer
    if (status === 'delivered') {
      const customer = await import('../models/User').then((m) => m.User.findById(order.userId))
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
    const order = await Order.findById(req.params.id)
    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }
    if (order.userId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ error: 'You do not have access to this order' })
      return
    }
    res.json(order)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' })
  }
})

export default router
