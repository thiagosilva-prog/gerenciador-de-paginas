import { createHmac, timingSafeEqual } from 'crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE_NAME = 'session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 dias

export interface SessionPayload {
  sub: string
  email: string
  nome: string | null
  exp: number
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET não configurado')
  return secret
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createSessionToken(user: { id: string; email: string; nome: string | null }): string {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    nome: user.nome,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  }
  const encoded = base64url(JSON.stringify(payload))
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null

  const expected = sign(encoded)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload: SessionPayload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function setSessionCookie(res: VercelResponse, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
  )
}

export function clearSessionCookie(res: VercelResponse) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`)
}

export function getSession(req: VercelRequest): SessionPayload | null {
  const token = req.cookies?.[COOKIE_NAME]
  return verifySessionToken(token)
}

/** Retorna a sessão se autenticado; caso contrário já escreve 401 na resposta e retorna null. */
export function requireAuth(req: VercelRequest, res: VercelResponse): SessionPayload | null {
  const session = getSession(req)
  if (!session) {
    res.status(401).json({ error: 'Não autenticado' })
    return null
  }
  return session
}
