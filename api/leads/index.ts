import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'
import { sql } from '../_lib/db.js'
import { requireAuth } from '../_lib/session.js'

// ponytail: fetch com timeout — se o destino (webhook do cliente ou Meta) não responder
// rápido, não deixamos a captura do lead travada esperando por ele.
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

async function dispatchWebhook(url: string, lead: Record<string, unknown>) {
  try {
    await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'lead.created', lead }),
    }, 5000)
  } catch (error) {
    console.error('webhook de conversão falhou:', error)
  }
}

// Envia o lead pro Facebook via Conversions API (server-side) usando o access token
// configurado na integração — o campo já existia na UI mas nunca era usado em lugar nenhum.
async function dispatchMetaConversion(
  facebook: { pixelId: string; accessToken: string; formConversionEvent?: string; testEventCode?: string },
  lead: { email?: string | null; telefone?: string | null; page_url?: string | null; ip?: string | null; user_agent?: string | null }
) {
  try {
    const userData: Record<string, unknown> = {}
    if (lead.email) userData.em = [sha256(lead.email)]
    if (lead.telefone) userData.ph = [sha256(lead.telefone.replace(/\D/g, ''))]
    if (lead.ip) userData.client_ip_address = lead.ip
    if (lead.user_agent) userData.client_user_agent = lead.user_agent

    const body: Record<string, unknown> = {
      data: [{
        event_name: facebook.formConversionEvent || 'CompleteRegistration',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: lead.page_url || undefined,
        user_data: userData,
      }],
    }
    if (facebook.testEventCode) body.test_event_code = facebook.testEventCode

    const res = await fetchWithTimeout(
      `https://graph.facebook.com/v19.0/${facebook.pixelId}/events?access_token=${encodeURIComponent(facebook.accessToken)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      5000
    )
    if (!res.ok) console.error('Meta Conversions API respondeu com erro:', res.status, await res.text().catch(() => ''))
  } catch (error) {
    console.error('Meta Conversions API falhou:', error)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      // Só o painel admin lista leads; a captura pública (POST) continua aberta.
      if (!requireAuth(req, res)) return

      const { page_id, period } = req.query
      if (typeof page_id !== 'string') return res.status(400).json({ error: 'page_id é obrigatório' })

      let query = `SELECT * FROM leads WHERE page_id = $1`
      const params: any[] = [page_id]

      if (typeof period === 'string' && period !== 'all') {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : null
        if (days) {
          query += ` AND criado_em >= now() - interval '${days} days'`
        }
      }
      query += ' ORDER BY criado_em DESC'

      const { rows } = await sql.query(query, params)
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const body = req.body || {}
      const page_id = body.page_id
      if (!page_id) return res.status(400).json({ error: 'page_id é obrigatório' })

      const forwarded = req.headers['x-forwarded-for']
      const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || null)
      const user_agent = req.headers['user-agent'] || null
      const referrer = body.page_url || req.headers['referer'] || null

      // Headers de geolocalização que a Vercel injeta automaticamente em produção
      // (não vêm preenchidos rodando localmente via `vercel dev`).
      const header = (name: string) => {
        const v = req.headers[name]
        return typeof v === 'string' && v.length > 0 ? decodeURIComponent(v) : null
      }
      const pais = header('x-vercel-ip-country')
      const estado = header('x-vercel-ip-country-region')
      const cidade = header('x-vercel-ip-city')

      const { rows } = await sql`
        INSERT INTO leads (
          page_id, nome, email, telefone,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          pais, cidade, estado, ip, user_agent, referrer
        ) VALUES (
          ${page_id}, ${body.nome || null}, ${body.email || null}, ${body.telefone || null},
          ${body.utm_source || null}, ${body.utm_medium || null}, ${body.utm_campaign || null},
          ${body.utm_term || null}, ${body.utm_content || null},
          ${pais}, ${cidade}, ${estado}, ${ip}, ${user_agent}, ${referrer}
        )
        RETURNING *
      `
      const lead = rows[0]

      // Dispara webhook do cliente e/ou Meta Conversions API, se configurados na página.
      // Roda antes de responder pra não ser cortado pelo runtime serverless, mas nunca
      // deixa a resposta da captura de lead depender do sucesso desses disparos.
      try {
        const { rows: pageRows } = await sql`SELECT integrations FROM pages WHERE id = ${page_id}`
        const integrations = pageRows[0]?.integrations || {}
        const dispatches: Promise<unknown>[] = []

        if (integrations.webhook?.enabled && integrations.webhook.url) {
          dispatches.push(dispatchWebhook(integrations.webhook.url, lead))
        }
        if (integrations.facebook?.enabled && integrations.facebook.accessToken && integrations.facebook.pixelId) {
          dispatches.push(dispatchMetaConversion(integrations.facebook, {
            email: lead.email, telefone: lead.telefone, page_url: referrer, ip, user_agent,
          }))
        }
        if (dispatches.length) await Promise.all(dispatches)
      } catch (error) {
        console.error('dispatch de integrações falhou:', error)
      }

      return res.status(200).json(lead)
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('api/leads error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
