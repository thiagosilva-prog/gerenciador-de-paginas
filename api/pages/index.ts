import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return

  try {
    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT * FROM pages ORDER BY atualizado_em DESC
      `
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const { nome, slug } = req.body || {}
      if (!nome || !slug) {
        return res.status(400).json({ error: 'nome e slug são obrigatórios' })
      }
      const { rows } = await sql`
        INSERT INTO pages (nome, slug, status, page_data)
        VALUES (${nome}, ${slug}, 'draft', '{"blocks":[]}'::jsonb)
        RETURNING *
      `
      return res.status(201).json(rows[0])
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma página com esse slug' })
    }
    console.error('api/pages error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
