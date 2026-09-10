import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import { renderPageResponse, sendNotFound } from './_lib/render-page-body.js'
import type { PageBlock } from '../src/lib/blocks/types.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = typeof req.query.slug === 'string' ? req.query.slug : Array.isArray(req.query.slug) ? req.query.slug[0] : ''

  if (!slug) return sendNotFound(res)

  try {
    const { rows } = await sql`
      SELECT id, nome, html, page_data FROM pages WHERE slug = ${slug} AND status = 'published'
    `
    const page = rows[0] as { id: string; nome: string; html: string | null; page_data: { blocks?: PageBlock[] } } | undefined

    if (!page) return sendNotFound(res)

    const forwardedFor = req.headers['x-forwarded-for']
    const ip = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : req.socket.remoteAddress
    await sql`INSERT INTO page_views (page_id, ip) VALUES (${page.id}, ${ip})`

    return renderPageResponse(res, page)
  } catch (error) {
    console.error('api/render-page error:', error)
    return sendNotFound(res)
  }
}
