import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db'
import { requireAuth } from '../_lib/session'

const ALLOWED_FIELDS = [
  'nome',
  'slug',
  'status',
  'page_data',
  'html',
  'integrations',
  'domain_id',
  'page_slug',
  'seo',
  'publicado_em',
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return

  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'id inválido' })

  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM pages WHERE id = ${id}`
      if (!rows[0]) return res.status(404).json({ error: 'Página não encontrada' })
      return res.status(200).json(rows[0])
    }

    if (req.method === 'PATCH') {
      const body = req.body || {}
      const entries = Object.entries(body).filter(([key]) => (ALLOWED_FIELDS as readonly string[]).includes(key))

      if (entries.length === 0) {
        const { rows } = await sql`SELECT * FROM pages WHERE id = ${id}`
        if (!rows[0]) return res.status(404).json({ error: 'Página não encontrada' })
        return res.status(200).json(rows[0])
      }

      const setClauses = entries.map(([key], i) => {
        const jsonbCols = ['page_data', 'integrations', 'seo']
        const cast = jsonbCols.includes(key) ? '::jsonb' : ''
        return `"${key}" = $${i + 1}${cast}`
      })
      const values = entries.map(([key, value]) => {
        const jsonbCols = ['page_data', 'integrations', 'seo']
        return jsonbCols.includes(key) ? JSON.stringify(value) : value
      })

      const queryText = `
        UPDATE pages
        SET ${setClauses.join(', ')}, atualizado_em = now()
        WHERE id = $${entries.length + 1}
        RETURNING *
      `
      const { rows } = await sql.query(queryText, [...values, id])
      if (!rows[0]) return res.status(404).json({ error: 'Página não encontrada' })
      return res.status(200).json(rows[0])
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM pages WHERE id = ${id}`
      return res.status(204).end()
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma página com esse slug' })
    }
    console.error('api/pages/[id] error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
