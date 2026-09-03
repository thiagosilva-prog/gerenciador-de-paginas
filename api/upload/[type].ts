import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put } from '@vercel/blob'
import { requireAuth } from '../_lib/session.js'

const FOLDERS: Record<string, string> = { image: 'pages', favicon: 'favicons' }

async function bufferStream(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req as any) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const type = typeof req.query.type === 'string' ? req.query.type : ''
  const folder = FOLDERS[type]
  if (!folder) return res.status(404).json({ error: 'Não encontrado' })

  const filename = typeof req.query.filename === 'string' ? req.query.filename : `upload-${Date.now()}`

  try {
    const body: Buffer = Buffer.isBuffer(req.body) ? req.body : await bufferStream(req)
    const blob = await put(`${folder}/${Date.now()}-${filename}`, body, { access: 'public' })
    return res.status(200).json({ url: blob.url })
  } catch (error) {
    console.error(`api/upload/${type} error:`, error)
    return res.status(500).json({ error: 'Erro ao enviar arquivo' })
  }
}
