import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      // Só o painel admin lista leads; a captura pública (POST) continua aberta.
      if (!requireAuth(req, res)) return

      const { page_id, period } = req.query
      if (typeof page_id !== 'string') return res.status(400).json({ error: 'page_id é obrigatório' })

      let query = `SELECT * FROM leads WHERE page_id = $1`
      const params: any[] = [page_id]

      if (typeof period === 'string' && period !== 'all') {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : null
        if (days) {
          query += ` AND criado_em >= now() - interval '${days} days'`
        }
      }
      query += ' ORDER BY criado_em DESC'

      const { rows } = await sql.query(query, params)
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const body = req.body || {}
      const page_id = body.page_id
      if (!page_id) return res.status(400).json({ error: 'page_id é obrigatório' })

      const forwarded = req.headers['x-forwarded-for']
      const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || null)
      const user_agent = req.headers['user-agent'] || null
      const referrer = body.page_url || req.headers['referer'] || null

      // Headers de geolocalização que a Vercel injeta automaticamente em produção
      // (não vêm preenchidos rodando localmente via `vercel dev`).
      const header = (name: string) => {
        const v = req.headers[name]
        return typeof v === 'string' && v.length > 0 ? decodeURIComponent(v) : null
      }
      const pais = header('x-vercel-ip-country')
      const estado = header('x-vercel-ip-country-region')
      const cidade = header('x-vercel-ip-city')

      const { rows } = await sql`
        INSERT INTO leads (
          page_id, nome, email, telefone,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          pais, cidade, estado, ip, user_agent, referrer
        ) VALUES (
          ${page_id}, ${body.nome || null}, ${body.email || null}, ${body.telefone || null},
          ${body.utm_source || null}, ${body.utm_medium || null}, ${body.utm_campaign || null},
          ${body.utm_term || null}, ${body.utm_content || null},
          ${pais}, ${cidade}, ${estado}, ${ip}, ${user_agent}, ${referrer}
        )
        RETURNING *
      `
      return res.status(200).json(rows[0])
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('api/leads error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
