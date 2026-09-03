import { useQuery } from "@tanstack/react-query";

export type ReportData = {
  visitas: number;
  visitas3m: number;
  conversoes: number;
  conversoes3m: number;
  taxaConversao: number;
  taxaConversao3m: number;
  series: { date: string; visitas: number; conversoes: number }[];
};

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro na requisição (${res.status})`);
  }
  return res.json();
}

export function useReport(pageId: string | undefined, period?: string) {
  return useQuery({
    queryKey: ["report", pageId, period],
    queryFn: () => apiFetch<ReportData>(`/api/reports?page_id=${pageId}&period=${period || "all"}`),
    enabled: !!pageId,
  });
}
