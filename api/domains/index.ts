import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db'
import { requireAuth } from '../_lib/session'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return

  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM domains ORDER BY created_at DESC`
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const { domain } = req.body || {}
      if (!domain) return res.status(400).json({ error: 'domain é obrigatório' })
      const { rows } = await sql`
        INSERT INTO domains (domain, ssl_active, verified)
        VALUES (${domain}, true, false)
        RETURNING *
      `
      return res.status(201).json(rows[0])
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Domínio já cadastrado' })
    }
    console.error('api/domains error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
