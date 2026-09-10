import type { VercelResponse } from '@vercel/node'
import { getBlockByType } from '../../src/lib/blocks/registry.js'
import type { PageBlock } from '../../src/lib/blocks/types.js'

export const NOT_FOUND_HTML = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Página não encontrada</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#64748b;gap:12px;">
<div style="font-size:48px;">🔒</div>
<p style="font-size:18px;font-weight:600;margin:0;">Esta página não está disponível</p>
<p style="font-size:14px;margin:0;">A página pode não existir ou ainda não foi publicada.</p>
</body></html>`

export function sendNotFound(res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(404).send(NOT_FOUND_HTML)
}

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

export function renderPageResponse(
  res: VercelResponse,
  page: { id: string; nome: string; html: string | null; page_data: { blocks?: PageBlock[] } },
  opts?: { cacheControl?: string; experimentId?: string }
) {
  let finalHtml = page.html || renderFromBlocks(page.id, page.nome, page.page_data?.blocks || [])
  if (opts?.experimentId) {
    finalHtml = finalHtml.replace('<head>', `<head><script>window.KV_EXPERIMENT_ID=${JSON.stringify(opts.experimentId)};</script>`)
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', opts?.cacheControl ?? 'public, s-maxage=60, stale-while-revalidate=300')
  return res.status(200).send(finalHtml)
}
