import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'

function slugify(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || 'teste'
  let n = 1
  while (true) {
    const { rows } = await sql`SELECT 1 FROM experiments WHERE slug = ${slug}`
    if (rows.length === 0) return slug
    n += 1
    slug = `${base}-${n}`
  }
}

async function statsFor(pageId: string) {
  const [visitas, conversoes] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM page_views WHERE page_id = ${pageId}`,
    sql`SELECT count(*)::int AS n FROM leads WHERE page_id = ${pageId}`,
  ])
  return { visitas: visitas.rows[0].n as number, conversoes: conversoes.rows[0].n as number }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return
  const action = typeof req.query.action === 'string' ? req.query.action : ''

  try {
    if (action === 'create' && req.method === 'POST') {
      const { nome, pageId } = req.body as { nome: string; pageId: string }
      if (!nome || !pageId) return res.status(400).json({ error: 'nome e pageId são obrigatórios' })
      const slug = await uniqueSlug(slugify(nome))
      const { rows } = await sql`
        INSERT INTO experiments (nome, slug) VALUES (${nome}, ${slug}) RETURNING id, nome, slug, status
      `
      const experiment = rows[0]
      await sql`INSERT INTO experiment_variants (experiment_id, page_id) VALUES (${experiment.id}, ${pageId})`
      return res.status(200).json(experiment)
    }

    if (action === 'for-page' && req.method === 'GET') {
      const pageId = typeof req.query.pageId === 'string' ? req.query.pageId : ''
      if (!pageId) return res.status(400).json({ error: 'pageId é obrigatório' })

      const { rows: expRows } = await sql`
        SELECT e.id, e.nome, e.slug, e.status
        FROM experiments e
        JOIN experiment_variants ev ON ev.experiment_id = e.id
        WHERE ev.page_id = ${pageId}
      `
      const experiment = expRows[0]
      if (!experiment) return res.status(200).json(null)

      const { rows: variantRows } = await sql`
        SELECT ev.page_id, p.nome, p.slug
        FROM experiment_variants ev
        JOIN pages p ON p.id = ev.page_id
        WHERE ev.experiment_id = ${experiment.id}
      `
      const variants = await Promise.all(
        variantRows.map(async (v) => ({ id: v.page_id, page_id: v.page_id, nome: v.nome, slug: v.slug, ...(await statsFor(v.page_id)) }))
      )
      return res.status(200).json({ ...experiment, variants })
    }

    if (action === 'add-variant' && req.method === 'POST') {
      const { experimentId, pageId } = req.body as { experimentId: string; pageId: string }
      if (!experimentId || !pageId) return res.status(400).json({ error: 'experimentId e pageId são obrigatórios' })
      await sql`INSERT INTO experiment_variants (experiment_id, page_id) VALUES (${experimentId}, ${pageId}) ON CONFLICT DO NOTHING`
      return res.status(200).json({ ok: true })
    }

    if (action === 'remove-variant' && req.method === 'POST') {
      const { experimentId, pageId } = req.body as { experimentId: string; pageId: string }
      if (!experimentId || !pageId) return res.status(400).json({ error: 'experimentId e pageId são obrigatórios' })
      const { rows: countRows } = await sql`SELECT count(*)::int AS n FROM experiment_variants WHERE experiment_id = ${experimentId}`
      if (countRows[0].n <= 1) return res.status(400).json({ error: 'O teste precisa de pelo menos uma variação' })
      await sql`DELETE FROM experiment_variants WHERE experiment_id = ${experimentId} AND page_id = ${pageId}`
      return res.status(200).json({ ok: true })
    }

    return res.status(404).json({ error: 'Ação desconhecida' })
  } catch (error) {
    console.error('api/experiments error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
