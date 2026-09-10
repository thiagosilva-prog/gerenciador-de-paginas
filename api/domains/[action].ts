import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'

async function list(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { rows } = await sql`SELECT * FROM domains ORDER BY created_at DESC`
  return res.status(200).json(rows)
}

async function create(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { domain } = req.body || {}
  if (!domain) return res.status(400).json({ error: 'domain é obrigatório' })
  try {
    const { rows } = await sql`
      INSERT INTO domains (domain, ssl_active, verified)
      VALUES (${domain}, true, false)
      RETURNING *
    `
    return res.status(201).json(rows[0])
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Domínio já cadastrado' })
    }
    throw error
  }
}

async function remove(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { id } = req.body || {}
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id inválido' })
  await sql`DELETE FROM domains WHERE id = ${id}`
  return res.status(204).end()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return
  const { action } = req.query

  try {
    if (action === 'list') return await list(req, res)
    if (action === 'create') return await create(req, res)
    if (action === 'delete') return await remove(req, res)
    return res.status(404).json({ error: 'Não encontrado' })
  } catch (error) {
    console.error('api/domains error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
