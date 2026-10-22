import * as React from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Copy, MoreVertical, Plus } from "lucide-react";
import { useExperimentForPage, useAddVariant, useRemoveVariant } from "../../hooks/useExperiments";
import { usePages } from "../../hooks/usePages";
import { Button } from "../../components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { toast } from "sonner";

const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin;

export default function PagesTesteAB() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: experiment, isLoading } = useExperimentForPage(id);
  const { data: allPages = [] } = usePages();
  const addVariant = useAddVariant(id);
  const removeVariant = useRemoveVariant(id);
  const [showAddVariant, setShowAddVariant] = React.useState(false);

  if (isLoading) return <div className="p-6">Carregando...</div>;
  if (!experiment) return <div className="p-6">Este teste não existe mais. <button onClick={() => navigate(`/pages/${id}`)}>Voltar</button></div>;

  const testUrl = `${PUBLIC_URL}/t/${experiment.slug}`;
  const variantPageIds = new Set(experiment.variants.map((v) => v.page_id));
  const candidatePages = allPages.filter((p) => !variantPageIds.has(p.id) && p.status === 'published');
  const MIN_VISITANTES = 50;
  const pctFmt = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 })}%`;
  const rodizioPct = experiment.variants.length ? 100 / experiment.variants.length : 0;
  const totalVisitantes = experiment.variants.reduce((s, v) => s + v.visitantes, 0);
  const totalCadastros = experiment.variants.reduce((s, v) => s + v.conversoes, 0);
  const taxa = (v: { visitantes: number; conversoes: number }) => (v.visitantes ? (v.conversoes / v.visitantes) * 100 : 0);
  // Só aponta vencedor quando TODA página já tem a amostra mínima.
  const vencedorId = experiment.variants.length > 1 && experiment.variants.every((v) => v.visitantes >= MIN_VISITANTES)
    ? experiment.variants.reduce((a, b) => (taxa(b) > taxa(a) ? b : a)).id
    : null;
  const desde = new Date(experiment.criado_em);
  const desdeFmt = `${desde.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${desde.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <button onClick={() => navigate(`/pages/${id}`)} className="flex items-center gap-2 text-sm text-(--text-tertiary) hover:text-(--text-primary)">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="bg-(--card-bg) border border-(--card-border) rounded-2xl p-5 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{experiment.nome} · rodízio {pctFmt(rodizioPct)}</h2>
        <p className="text-sm text-(--text-tertiary)">
          Desde {desdeFmt} · {totalVisitantes} visitantes, {totalCadastros} cadastros
          ({totalVisitantes ? pctFmt((totalCadastros / totalVisitantes) * 100) : "—"}) · cada página deve receber
          ~{pctFmt(rodizioPct)} dos visitantes · a decisão é pela % de cadastro (mínimo {MIN_VISITANTES} visitantes por página)
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[13px] text-(--text-secondary) truncate">{testUrl}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(testUrl); toast.success("Link copiado!"); }}
            className="p-2 hover:bg-(--card-hover) text-(--text-tertiary) hover:text-(--text-primary) rounded-2xl transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-(--card-bg) border border-(--card-border) rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--card-border) text-left text-(--text-tertiary)">
              <th className="p-3 font-medium">Página</th>
              <th className="p-3 font-medium text-right">Visitantes</th>
              <th className="p-3 font-medium text-right">Fatia</th>
              <th className="p-3 font-medium text-right">Cadastros</th>
              <th className="p-3 font-medium text-right">% Cadastro</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {experiment.variants.map((v) => (
              <tr key={v.id} className="border-b border-(--card-border) last:border-0">
                <td className="p-3">
                  {v.id === vencedorId && <span className="mr-1" title="Maior % de cadastro">🏆</span>}
                  <button onClick={() => navigate(`/pages/${v.page_id}`)} className="font-medium hover:underline">{v.nome}</button>
                </td>
                <td className="p-3 text-right tabular-nums">{v.visitantes}</td>
                <td className="p-3 text-right tabular-nums">{totalVisitantes ? pctFmt((v.visitantes / totalVisitantes) * 100) : "—"}</td>
                <td className="p-3 text-right tabular-nums">{v.conversoes}</td>
                <td className="p-3 text-right tabular-nums font-semibold">{v.visitantes ? pctFmt(taxa(v)) : "—"}</td>
                <td className="p-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 hover:bg-(--card-hover) rounded-lg"><MoreVertical className="w-4 h-4" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => removeVariant.mutate(
                          { experimentId: experiment.id, pageId: v.page_id },
                          { onError: (err) => toast.error(err.message) }
                        )}
                        className="text-red-500 focus:text-red-500"
                      >
                        Remover do teste
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-3">
          <Button variant="outline" size="sm" onClick={() => setShowAddVariant(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar variação
          </Button>
        </div>
      </div>

      <Dialog open={showAddVariant} onOpenChange={setShowAddVariant}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar variação</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {candidatePages.length === 0 && <p className="text-sm text-(--text-tertiary)">Nenhuma página disponível.</p>}
            {candidatePages.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  addVariant.mutate(
                    { experimentId: experiment.id, pageId: p.id },
                    { onError: (err) => toast.error(err.message) }
                  );
                  setShowAddVariant(false);
                }}
                className="text-left p-2 hover:bg-(--card-hover) rounded-lg text-sm"
              >
                {p.nome}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
