import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { sql } from '../_lib/db.js'

export const config = { api: { bodyParser: false } }

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function verifySignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const actual = signatureHeader.slice('sha256='.length)
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(actual, 'hex')
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf)
}

async function fetchFileContent(owner: string, repo: string, path: string, ref: string): Promise<string> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github.raw' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `token ${process.env.GITHUB_TOKEN}`
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
    { headers }
  )
  if (!res.ok) throw new Error(`GitHub API ${res.status} ao buscar ${path}`)
  return res.text()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) return res.status(500).json({ error: 'GITHUB_WEBHOOK_SECRET não configurado' })

  const rawBody = await readRawBody(req)
  if (!verifySignature(rawBody, req.headers['x-hub-signature-256'] as string | undefined, secret)) {
    return res.status(401).json({ error: 'Assinatura inválida' })
  }

  const event = req.headers['x-github-event']
  if (event === 'ping') return res.status(200).json({ ok: true })
  if (event !== 'push') return res.status(200).json({ ignored: event })

  const payload = JSON.parse(rawBody.toString('utf8'))
  const owner = payload?.repository?.owner?.login
  const repo = payload?.repository?.name
  const ref = payload?.after
  if (!owner || !repo || !ref) return res.status(400).json({ error: 'Payload inválido' })

  const paths = new Set<string>()
  for (const commit of payload.commits || []) {
    for (const p of [...(commit.added || []), ...(commit.modified || [])]) {
      if (p.endsWith('.html')) paths.add(p)
    }
  }

  const updated: string[] = []
  const skipped: { path: string; reason: string }[] = []

  for (const path of paths) {
    const slug = path.split('/').pop()!.replace(/\.html$/, '')
    const { rows } = await sql`SELECT id, page_data FROM pages WHERE slug = ${slug}`
    const page = rows[0]
    if (!page) {
      skipped.push({ path, reason: `nenhuma página com slug "${slug}"` })
      continue
    }

    const pageData = page.page_data || { blocks: [] }
    const block = (pageData.blocks || []).find((b: any) => b.type === 'custom_html')
    if (!block) {
      skipped.push({ path, reason: `página "${slug}" não tem bloco custom_html` })
      continue
    }

    const html = await fetchFileContent(owner, repo, path, ref)
    block.data = { ...block.data, html }

    await sql`UPDATE pages SET page_data = ${JSON.stringify(pageData)}::jsonb, atualizado_em = now() WHERE id = ${page.id}`
    updated.push(slug)
  }

  return res.status(200).json({ updated, skipped })
}
