import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put } from '@vercel/blob'
import { requireAuth } from './_lib/session.js'

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

  const filename = typeof req.query.filename === 'string' ? req.query.filename : `upload-${Date.now()}`

  try {
    const body: Buffer = Buffer.isBuffer(req.body) ? req.body : await bufferStream(req)
    const blob = await put(`favicons/${Date.now()}-${filename}`, body, { access: 'public' })
    return res.status(200).json({ url: blob.url })
  } catch (error) {
    console.error('api/upload-favicon error:', error)
    return res.status(500).json({ error: 'Erro ao enviar arquivo' })
  }
}
