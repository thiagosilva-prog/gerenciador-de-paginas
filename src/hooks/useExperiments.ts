import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface ExperimentVariant {
  id: string
  page_id: string
  nome: string
  slug: string
  visitas: number
  conversoes: number
}

export interface Experiment {
  id: string
  nome: string
  slug: string
  status: string
  variants: ExperimentVariant[]
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
  return res.json()
}

export function useExperimentForPage(pageId: string | undefined) {
  return useQuery({
    queryKey: ['experiment', pageId],
    queryFn: () => apiFetch<Experiment | null>(`/api/experiments/for-page?pageId=${pageId}`),
    enabled: !!pageId,
  })
}

export function useCreateExperiment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { nome: string; pageId: string }) =>
      apiFetch<Experiment>('/api/experiments/create', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['experiment', variables.pageId] })
    },
  })
}

export function useAddVariant(pageId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { experimentId: string; pageId: string }) =>
      apiFetch<{ ok: true }>('/api/experiments/add-variant', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiment', pageId] })
    },
  })
}

export function useRemoveVariant(pageId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { experimentId: string; pageId: string }) =>
      apiFetch<{ ok: true }>('/api/experiments/remove-variant', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiment', pageId] })
    },
  })
}
