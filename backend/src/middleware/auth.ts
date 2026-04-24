import { Request, Response, NextFunction } from 'express'
import { User, IUser } from '../models/User'
import { verifySession } from '../lib/jwt'

// Augment Express.Request so req.user is typed on protected routes.
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
    // expired, tampered, or user deleted — treat as unauthenticated
    return null
  }
}

// Rejects the request if no valid JWT is present.
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = await resolveUserFromBearer(req)
  if (!user) {
    res.status(401).json({ error: 'Sign in required' })
    return
  }
  req.user = user
  next()
}

// Attaches req.user when a valid JWT is present, but never blocks the request.
export async function optionalUser(req: Request, _res: Response, next: NextFunction) {
  const user = await resolveUserFromBearer(req).catch(() => null)
  if (user) req.user = user
  next()
}
