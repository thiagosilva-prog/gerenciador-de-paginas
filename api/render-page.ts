import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import { renderPageResponse, sendNotFound } from './_lib/render-page-body.js'
import type { PageBlock } from '../src/lib/blocks/types.js'

type PageRow = { id: string; nome: string; html: string | null; page_data: { blocks?: PageBlock[] } }

async function insertView(pageId: string, req: VercelRequest, experimentId?: string) {
  const forwardedFor = req.headers['x-forwarded-for']
  const ip = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : req.socket.remoteAddress
  await sql`INSERT INTO page_views (page_id, ip, experiment_id) VALUES (${pageId}, ${ip}, ${experimentId ?? null})`
}

function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map((pair) => {
      const idx = pair.indexOf('=')
      const raw = pair.slice(idx + 1).trim()
      let value = raw
      try {
        value = decodeURIComponent(raw)
      } catch {
        // malformed percent-encoding in a third-party cookie — fall back to the raw value
      }
      return [pair.slice(0, idx).trim(), value]
    })
  )
}

async function handleExperiment(req: VercelRequest, res: VercelResponse, experimentSlug: string) {
  const { rows: expRows } = await sql`
    SELECT id FROM experiments WHERE slug = ${experimentSlug} AND status = 'running'
  `
  const experiment = expRows[0] as { id: string } | undefined
  if (!experiment) return sendNotFound(res)

  const { rows: variantRows } = await sql`
    SELECT p.id, p.nome, p.html, p.page_data
    FROM experiment_variants ev
    JOIN pages p ON p.id = ev.page_id
    WHERE ev.experiment_id = ${experiment.id} AND p.status = 'published'
  `
  const variants = variantRows as PageRow[]
  if (variants.length === 0) return sendNotFound(res)

  const cookieName = `exp_${experiment.id}`
  const cookies = parseCookies(req)
  const stickyPageId = cookies[cookieName]
  let page = variants.find((v) => v.id === stickyPageId)

  if (!page) {
    page = variants[Math.floor(Math.random() * variants.length)]
    res.setHeader('Set-Cookie', `${cookieName}=${page.id}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax`)
  }

  await insertView(page.id, req, experiment.id)
  return renderPageResponse(res, page, { cacheControl: 'private, no-store', experimentId: experiment.id })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const getParam = (key: string) => {
    const v = req.query[key]
    return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : ''
  }
  const experimentSlug = getParam('experimentSlug')
  const slug = getParam('slug')

  try {
    if (experimentSlug) return await handleExperiment(req, res, experimentSlug)

    if (!slug) return sendNotFound(res)

    const { rows } = await sql`
      SELECT id, nome, html, page_data FROM pages WHERE slug = ${slug} AND status = 'published'
    `
    const page = rows[0] as PageRow | undefined
    if (!page) return sendNotFound(res)

    await insertView(page.id, req)
    return renderPageResponse(res, page)
  } catch (error) {
    console.error('api/render-page error:', error)
    return sendNotFound(res)
  }
}
