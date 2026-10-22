import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import { renderPageResponse, sendNotFound } from './_lib/render-page-body.js'
import type { PageBlock } from '../src/lib/blocks/types.js'

type PageRow = { id: string; nome: string; html: string | null; page_data: { blocks?: PageBlock[] } }

// Robôs e pré-visualizações de link (WhatsApp, Meta, Telegram...) fazem GET
// na página como um visitante — sem esse filtro inflam as visitas.
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|telegram|skypeuripreview|preview|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|node-fetch/i

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function insertView(pageId: string, req: VercelRequest, experimentId?: string, vid?: string) {
  const userAgent = req.headers['user-agent'] || ''
  if (!userAgent || BOT_UA.test(userAgent)) return

  const forwardedFor = req.headers['x-forwarded-for']
  const ip = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : req.socket.remoteAddress
  const q = (key: string) => {
    const v = req.query[key]
    return (typeof v === 'string' ? v : Array.isArray(v) ? v[0] : '') || null
  }
  const referrer = req.headers['referer'] || null
  await sql`
    INSERT INTO page_views (
      page_id, ip, experiment_id, vid,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, user_agent
    ) VALUES (
      ${pageId}, ${ip}, ${experimentId ?? null}, ${vid ?? null},
      ${q('utm_source')}, ${q('utm_medium')}, ${q('utm_campaign')}, ${q('utm_term')}, ${q('utm_content')},
      ${referrer}, ${userAgent}
    )
  `
}

// Falha ao registrar a visita nunca pode derrubar a página (ex.: deploy que
// chegou antes da migration das colunas novas).
function recordView(...args: Parameters<typeof insertView>) {
  return insertView(...args).catch((error) => console.error('page_views insert error:', error))
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
  const setCookies: string[] = []

  let vid = cookies.kv_vid
  if (!vid || !UUID_RE.test(vid)) {
    vid = crypto.randomUUID()
    setCookies.push(`kv_vid=${vid}; HttpOnly; Path=/; Max-Age=31536000; SameSite=Lax`)
  }

  const stickyPageId = cookies[cookieName]
  let page = variants.find((v) => v.id === stickyPageId)

  if (!page) {
    page = variants[Math.floor(Math.random() * variants.length)]
    setCookies.push(`${cookieName}=${page.id}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax`)
  }
  if (setCookies.length) res.setHeader('Set-Cookie', setCookies)

  await recordView(page.id, req, experiment.id, vid)
  return renderPageResponse(res, page, { cacheControl: 'private, no-store', experimentId: experiment.id, vid })
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

    // Se a requisição chegou por um domínio personalizado cadastrado, busca
    // SÓ pelo "link da página" (page_slug) daquele domínio — nunca mistura
    // com o slug padrão, pra não arriscar bater por coincidência numa
    // página completamente diferente que tenha esse mesmo slug.
    const host = (req.headers.host || '').split(':')[0]
    const { rows: domainRows } = await sql`SELECT id FROM domains WHERE domain = ${host}`
    const domain = domainRows[0] as { id: string } | undefined

    const { rows } = domain
      ? await sql`
          SELECT id, nome, html, page_data FROM pages
          WHERE status = 'published' AND domain_id = ${domain.id} AND page_slug = ${slug}
        `
      : await sql`
          SELECT id, nome, html, page_data FROM pages
          WHERE status = 'published' AND slug = ${slug}
        `
    const page = rows[0] as PageRow | undefined
    if (!page) return sendNotFound(res)

    // A página onde o teste foi criado (primeira variante) vira porta de
    // entrada: com o teste rodando, o próprio /p/ dela sorteia entre as
    // variantes — dá pra testar sem trocar o link de uma campanha no ar.
    // ponytail: "criadora" = variante mais antiga; se ela for removida do
    // teste, a próxima mais antiga assume. Coluna entry_page_id se incomodar.
    const { rows: entryRows } = await sql`
      SELECT e.slug FROM experiments e
      WHERE e.status = 'running' AND (
        SELECT ev.page_id FROM experiment_variants ev
        WHERE ev.experiment_id = e.id
        ORDER BY ev.criado_em LIMIT 1
      ) = ${page.id}
      LIMIT 1
    `
    if (entryRows[0]) return await handleExperiment(req, res, entryRows[0].slug as string)

    await recordView(page.id, req)
    return renderPageResponse(res, page)
  } catch (error) {
    console.error('api/render-page error:', error)
    return sendNotFound(res)
  }
}
