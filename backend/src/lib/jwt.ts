import jwt from 'jsonwebtoken'
import { config } from '@config/AppConfig'

export function signSession(userId: string): string {
  const { secret, expiresIn } = config.jwt()
  return jwt.sign({ sub: userId }, secret, { expiresIn } as jwt.SignOptions)
}

export function verifySession(token: string): string {
  const { secret } = config.jwt()
  const payload = jwt.verify(token, secret) as jwt.JwtPayload
  if (!payload.sub) throw new Error('Invalid token payload')
  return payload.sub
}
