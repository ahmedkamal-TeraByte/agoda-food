import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d'

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions)
}

export function verifySession(token: string): string {
  const payload = jwt.verify(token, SECRET) as jwt.JwtPayload
  if (!payload.sub) throw new Error('Invalid token payload')
  return payload.sub
}
