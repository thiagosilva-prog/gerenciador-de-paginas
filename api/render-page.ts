import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import { getBlockByType } from '../src/lib/blocks/registry.js'
import type { PageBlock } from '../src/lib/blocks/types.js'

const NOT_FOUND_HTML = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Página não encontrada</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#64748b;gap:12px;">
<div style="font-size:48px;">🔒</div>
<p style="font-size:18px;font-weight:600;margin:0;">Esta página não está disponível</p>
<p style="font-size:14px;margin:0;">A página pode não existir ou ainda não foi publicada.</p>
</body></html>`

function renderFromBlocks(pageId: string, nome: string, blocks: PageBlock[]): string {
  const body = blocks
    .filter((b) => !b.hidden)
    .map((b) => {
      const def = getBlockByType(b.type)
      if (!def) return ''
      return def.render(b.data, b.sectionStyles).replace(/\{\{PAGE_ID\}\}/g, pageId)
    })
    .join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${nome || 'Página'}</title><script src="https://cdn.tailwindcss.com"></script></head><body style="margin:0;padding:0;">${body}</body></html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = typeof req.query.slug === 'string' ? req.query.slug : Array.isArray(req.query.slug) ? req.query.slug[0] : ''

  if (!slug) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(404).send(NOT_FOUND_HTML)
  }

  try {
    const { rows } = await sql`
      SELECT id, nome, html, page_data FROM pages WHERE slug = ${slug} AND status = 'published'
    `
    const page = rows[0] as { id: string; nome: string; html: string | null; page_data: { blocks?: PageBlock[] } } | undefined

    if (!page) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.status(404).send(NOT_FOUND_HTML)
    }

    const finalHtml = page.html || renderFromBlocks(page.id, page.nome, page.page_data?.blocks || [])

    const forwardedFor = req.headers['x-forwarded-for']
    const ip = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : req.socket.remoteAddress
    await sql`INSERT INTO page_views (page_id, ip) VALUES (${page.id}, ${ip})`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return res.status(200).send(finalHtml)
  } catch (error) {
    console.error('api/render-page error:', error)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(500).send(NOT_FOUND_HTML)
  }
}
