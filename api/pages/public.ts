import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { slug } = req.query
  if (typeof slug !== 'string') return res.status(400).json({ error: 'slug inválido' })

  try {
    const { rows } = await sql`
      SELECT * FROM pages WHERE slug = ${slug} AND status = 'published'
    `
    if (!rows[0]) return res.status(404).json({ error: 'Página não encontrada' })
    return res.status(200).json(rows[0])
  } catch (error) {
    console.error('api/pages/public error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
