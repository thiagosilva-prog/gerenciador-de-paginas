import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import { requireAuth } from './_lib/session.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return

  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM page_folders ORDER BY nome ASC`
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const { nome } = req.body || {}
      if (!nome || !String(nome).trim()) {
        return res.status(400).json({ error: 'nome é obrigatório' })
      }
      const { rows } = await sql`
        INSERT INTO page_folders (nome) VALUES (${String(nome).trim()}) RETURNING *
      `
      return res.status(201).json(rows[0])
    }

    if (req.method === 'PATCH') {
      const { id, nome } = req.body || {}
      if (!id || !nome || !String(nome).trim()) {
        return res.status(400).json({ error: 'id e nome são obrigatórios' })
      }
      const { rows } = await sql`
        UPDATE page_folders SET nome = ${String(nome).trim()}, atualizado_em = now()
        WHERE id = ${id}
        RETURNING *
      `
      if (!rows[0]) return res.status(404).json({ error: 'Pasta não encontrada' })
      return res.status(200).json(rows[0])
    }

    if (req.method === 'DELETE') {
      const id = (req.query.id as string | undefined) ?? (req.body || {}).id
      if (!id) return res.status(400).json({ error: 'id é obrigatório' })
      await sql`UPDATE pages SET folder_id = NULL WHERE folder_id = ${id}`
      await sql`DELETE FROM page_folders WHERE id = ${id}`
      return res.status(204).end()
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('api/folders error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
