import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageData } from '../lib/blocks/types'

export interface PageIntegrations {
  customCodes?: Array<{
    id: string
    name: string
    type: 'funcionamento' | 'estatisticas' | 'marketing'
    enabled: boolean
    code: string
  }>
  facebook?: {
    enabled: boolean
    pixelId: string
    accessToken: string
    trackingEvent: string       // 'PageView' | 'ViewContent' | 'Lead' | etc
    customTrackingEvent?: string
    testEventCode: string
    formConversionEvent: string // 'CompleteRegistration' | 'Lead' | 'Purchase'
  }
  googleAnalytics?: {
    enabled: boolean
    measurementId: string       // G-XXXXXXXXXX
  }
  googleTagManager?: {
    enabled: boolean
    containerId: string         // GTM-XXXXXXX
  }
}

export interface Page {
  id: string
  nome: string
  slug: string
  status: 'draft' | 'published'
  page_data: PageData
  html: string | null
  publicado_em: string | null
  criado_em: string
  atualizado_em: string
  integrations?: PageIntegrations
  domain_id?: string | null
  page_slug?: string | null
  seo?: {
    enable_indexing?: boolean
    title?: string
    description?: string
    keywords?: string
    favicon_url?: string
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Erro na requisição (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export function usePages() {
  return useQuery({
    queryKey: ['pages'],
    queryFn: () => apiFetch<Page[]>('/api/pages'),
  })
}

export function usePage(id: string | undefined) {
  return useQuery({
    queryKey: ['page', id],
    queryFn: () => apiFetch<Page>(`/api/pages/${id}`),
    enabled: !!id,
  })
}

export function useCreatePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { nome: string; slug: string }) =>
      apiFetch<Page>('/api/pages', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pages'] })
    },
  })
}

export function useUpdatePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<Page> & { id: string }) =>
      apiFetch<Page>(`/api/pages/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['page', data.id] })
      qc.invalidateQueries({ queryKey: ['pages'] })
    },
  })
}

export function useDeletePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiFetch<void>(`/api/pages/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pages'] })
    },
  })
}

export function generateSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
