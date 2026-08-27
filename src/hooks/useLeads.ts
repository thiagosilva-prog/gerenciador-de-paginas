import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type Lead = {
  id: string;
  page_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  utm_audience: string | null;
  referral_source: string | null;
  event_id: string | null;
  pais: string | null;
  cidade: string | null;
  estado: string | null;
  ip: string | null;
  user_agent: string | null;
  referrer: string | null;
  campos_extras: Record<string, any>;
  criado_em: string;
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro na requisição (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function useLeads(pageId: string | undefined, period?: string) {
  return useQuery({
    queryKey: ["leads", pageId, period],
    queryFn: () => {
      const params = new URLSearchParams({ page_id: pageId! });
      if (period && period !== "all") params.set("period", period);
      return apiFetch<Lead[]>(`/api/leads?${params.toString()}`);
    },
    enabled: !!pageId,
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => apiFetch<void>(`/api/leads/${leadId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
