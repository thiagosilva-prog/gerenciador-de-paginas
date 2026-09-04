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
  clarity?: {
    enabled: boolean
    code: string                // Snippet <script> completo, colado direto do Clarity
  }
  webhook?: {
    enabled: boolean
    url: string                  // URL que recebe um POST a cada lead capturado nessa página
  }
}

export interface PageSettings {
  velocidade?: {
    zoom?: boolean
    minifyImages?: boolean
    minifyJs?: boolean
    minifyCss?: boolean
    minifyHtml?: boolean
    shimmerEffect?: boolean
    lazyLoading?: boolean
  }
  lgpd?: {
    cookieNotice?: boolean
  }
  seguranca?: {
    encryptFormData?: boolean
    ssl?: boolean
  }
  notificacoesLeads?: {
    title?: string
    emails?: string[]
    senderName?: string
    replyEmail?: string
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
  settings?: PageSettings
  folder_id?: string | null
  seo?: {
    enable_indexing?: boolean
    canonical_enabled?: boolean
    title?: string
    description?: string
    keywords?: string
    favicon_url?: string
    social_company_name?: string
    social_title?: string
    social_description?: string
    social_image_url?: string
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

export interface PageFolder {
  id: string
  nome: string
  criado_em: string
  atualizado_em: string
}

export function useFolders() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: () => apiFetch<PageFolder[]>('/api/folders'),
  })
}

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { nome: string }) =>
      apiFetch<PageFolder>('/api/folders', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  })
}

export function useRenameFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; nome: string }) =>
      apiFetch<PageFolder>('/api/folders', { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiFetch<void>(`/api/folders?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] })
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
