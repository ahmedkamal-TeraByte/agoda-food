import { Request, Response, NextFunction } from 'express'
import { User, IUser } from '@models/User'
import { Restaurant } from '@models/Restaurant'
import { verifySession } from '@lib/jwt'

declare global {
  namespace Express {
    interface Request {
      user?: IUser
    }
  }
}

async function resolveUserFromBearer(req: Request): Promise<IUser | null> {
  const header = req.header('Authorization') ?? ''
  if (!header.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  if (!token) return null

  try {
    const userId = verifySession(token)
    return await User.findById(userId)
  } catch {
    return null
  }
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = await resolveUserFromBearer(req)
  if (!user) {
    res.status(401).json({ error: 'Sign in required' })
    return
  }
  req.user = user
  next()
}

export async function optionalUser(req: Request, _res: Response, next: NextFunction) {
  const user = await resolveUserFromBearer(req).catch(() => null)
  if (user) req.user = user
  next()
}

/**
 * Requires the caller to have role=merchant and to own the restaurant identified
 * by req.params.restaurantId (when present). If no restaurantId param is given,
 * only the role check is applied — the individual handler must verify ownership.
 */
export async function requireMerchant(req: Request, res: Response, next: NextFunction) {
  const user = await resolveUserFromBearer(req)
  if (!user) {
    res.status(401).json({ error: 'Sign in required' })
    return
  }
  if (user.role !== 'merchant') {
    res.status(403).json({ error: 'Merchant access required' })
    return
  }
  req.user = user

  // Ownership check when a restaurantId param is present
  const restaurantId = req.params.restaurantId
  if (restaurantId) {
    const restaurant = await Restaurant.findById(restaurantId)
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' })
      return
    }
    if (restaurant.ownerUserId.toString() !== user._id.toString()) {
      res.status(403).json({ error: 'You do not own this restaurant' })
      return
    }
  }

  next()
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await resolveUserFromBearer(req)
  if (!user) {
    res.status(401).json({ error: 'Sign in required' })
    return
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  req.user = user
  next()
}
