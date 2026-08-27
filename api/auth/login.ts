import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db.js'
import { createSessionToken, setSessionCookie } from '../_lib/session.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' })
  }

  try {
    const { rows } = await sql`
      SELECT id, email, nome
      FROM users
      WHERE email = ${email} AND password_hash = crypt(${password}, password_hash)
    `
    const user = rows[0] as { id: string; email: string; nome: string | null } | undefined
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' })
    }

    const token = createSessionToken(user)
    setSessionCookie(res, token)
    return res.status(200).json({ user })
  } catch (error) {
    console.error('api/auth/login error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
