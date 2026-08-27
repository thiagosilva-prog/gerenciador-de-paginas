import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSession } from '../_lib/session.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'Não autenticado' })

  return res.status(200).json({ user: { id: session.sub, email: session.email, nome: session.nome } })
}
