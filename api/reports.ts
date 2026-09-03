import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import { requireAuth } from './_lib/session.js'

const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!requireAuth(req, res)) return

  const { page_id, period } = req.query
  if (typeof page_id !== 'string') return res.status(400).json({ error: 'page_id é obrigatório' })

  try {
    const periodDays = typeof period === 'string' ? PERIOD_DAYS[period] : undefined
    const seriesDays = periodDays || 90 // ponytail: período "all" mostra os últimos 90 dias no gráfico, sem consulta ilimitada

    const [visitas, visitas3m, conversoes, conversoes3m, series] = await Promise.all([
      periodDays
        ? sql.query(`SELECT count(*)::int AS n FROM page_views WHERE page_id = $1 AND criado_em >= now() - interval '${periodDays} days'`, [page_id])
        : sql.query(`SELECT count(*)::int AS n FROM page_views WHERE page_id = $1`, [page_id]),
      sql.query(`SELECT count(*)::int AS n FROM page_views WHERE page_id = $1 AND criado_em >= now() - interval '90 days'`, [page_id]),
      periodDays
        ? sql.query(`SELECT count(*)::int AS n FROM leads WHERE page_id = $1 AND criado_em >= now() - interval '${periodDays} days'`, [page_id])
        : sql.query(`SELECT count(*)::int AS n FROM leads WHERE page_id = $1`, [page_id]),
      sql.query(`SELECT count(*)::int AS n FROM leads WHERE page_id = $1 AND criado_em >= now() - interval '90 days'`, [page_id]),
      sql.query(
        `SELECT
           d::date AS date,
           coalesce((SELECT count(*) FROM page_views WHERE page_id = $1 AND criado_em::date = d::date), 0)::int AS visitas,
           coalesce((SELECT count(*) FROM leads WHERE page_id = $1 AND criado_em::date = d::date), 0)::int AS conversoes
         FROM generate_series(now()::date - ($2::int - 1), now()::date, interval '1 day') AS d
         ORDER BY d`,
        [page_id, seriesDays]
      ),
    ])

    const v = visitas.rows[0].n
    const v3m = visitas3m.rows[0].n
    const c = conversoes.rows[0].n
    const c3m = conversoes3m.rows[0].n
    const taxa = v ? (c / v) * 100 : 0
    const taxa3m = v3m ? (c3m / v3m) * 100 : 0

    return res.status(200).json({
      visitas: v,
      visitas3m: v3m,
      conversoes: c,
      conversoes3m: c3m,
      taxaConversao: taxa,
      taxaConversao3m: taxa3m,
      series: series.rows,
    })
  } catch (error) {
    console.error('api/reports error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
