import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db'
import { requireAuth } from '../_lib/session'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return

  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'id inválido' })

  try {
    if (req.method === 'DELETE') {
      await sql`DELETE FROM domains WHERE id = ${id}`
      return res.status(204).end()
    }

    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('api/domains/[id] error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
