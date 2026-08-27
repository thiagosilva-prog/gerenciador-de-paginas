import * as React from "react";
import { useNavigate } from "react-router";
import { Plus, FileText, Globe, Trash2, Pencil, ExternalLink, LogOut } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { usePages, useCreatePage, useDeletePage, generateSlug, type Page } from "../../hooks/usePages";
import { useAuth } from "../../hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PagesIndex() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newPageNome, setNewPageNome] = React.useState("");
  const [newPageSlug, setNewPageSlug] = React.useState("");
  const [slugManual, setSlugManual] = React.useState(false);

  const { data: paginas = [], isLoading } = usePages();

  const createPage = useCreatePage();
  const deletePage = useDeletePage();

  const handleNomeChange = (v: string) => {
    setNewPageNome(v);
    if (!slugManual) setNewPageSlug(generateSlug(v));
  };

  const handleCreate = async () => {
    if (!newPageNome.trim()) return;
    try {
      const page = await createPage.mutateAsync({
        nome: newPageNome.trim(),
        slug: newPageSlug || generateSlug(newPageNome),
      });
      toast.success("Página criada!");
      setShowCreateModal(false);
      setNewPageNome("");
      setNewPageSlug("");
      setSlugManual(false);
      navigate(`/pages/${page.id}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar página");
    }
  };

  const handleDelete = async (page: Page) => {
    if (!window.confirm(`Excluir "${page.nome}"?`)) return;
    try {
      await deletePage.mutateAsync({ id: page.id });
      toast.success("Página excluída");
    } catch (e: any) {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-(--text-tertiary)" />
            <h2 className="text-[22px] font-semibold text-(--text-primary)" style={{ letterSpacing: '-0.374px' }}>Páginas</h2>
          </div>
          <p className="text-[13px] text-(--text-secondary) mt-1">
            Gerencie suas landing pages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="btn-brand h-9 px-4 text-[13px] rounded-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nova página
          </Button>
          <button
            title="Sair"
            onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
            className="h-9 w-9 flex items-center justify-center text-(--text-tertiary) hover:text-(--text-primary) hover:bg-(--card-hover) rounded-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-36 rounded-xl" />)}
        </div>
      ) : paginas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-dashed bg-(--card-bg) border border-(--card-border) rounded-[14px]">
          <div className="h-14 w-14 rounded-full bg-(--card-hover) border border-(--card-border) flex items-center justify-center mb-4">
            <Globe className="h-6 w-6 text-(--text-tertiary)" />
          </div>
          <h3 className="text-[15px] font-semibold text-(--text-primary) mb-1">Nenhuma página criada ainda</h3>
          <p className="text-[13px] text-(--text-tertiary) mb-6 max-w-sm">Crie sua primeira landing page.</p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="btn-brand h-9 px-4 text-[13px] rounded-full"
          >
            Criar primeira página
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginas.map(page => (
            <div
              key={page.id}
              className="bg-(--card-bg) border border-(--card-border) rounded-[14px] p-5 hover:border-[#FBB03B]/30 hover:bg-[#FBB03B]/5 transition-colors flex flex-col gap-3 cursor-pointer group"
              onClick={() => navigate(`/pages/${page.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[15px] text-(--text-primary) mb-1" style={{ letterSpacing: '-0.2px' }}>{page.nome}</h3>
                  <p className="text-[13px] text-(--text-tertiary) truncate">/{page.slug}</p>
                </div>
                {page.status === "published" ? (
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-emerald-500/10 text-emerald-500">
                    Publicada
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-(--card-hover) text-(--text-tertiary)">
                    Rascunho
                  </span>
                )}
              </div>

              <p className="text-[12px] text-(--text-tertiary)">
                Atualizada {formatDistanceToNow(new Date(page.atualizado_em), { locale: ptBR, addSuffix: true })}
              </p>

              <div className="flex gap-2 mt-auto pt-4 border-t border-(--card-border)" onClick={e => e.stopPropagation()}>
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-(--card-border) text-[13px] font-medium text-(--text-secondary) bg-transparent hover:bg-(--card-hover) hover:text-(--text-primary) transition-colors cursor-pointer"
                  onClick={() => navigate(`/pages/${page.id}`)}
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                {page.status === "published" && (
                  <a
                    href={`/p/${page.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-2.5 rounded-[10px] border border-(--card-border) text-(--text-secondary) hover:bg-(--card-hover) hover:text-(--text-primary) transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  className="flex items-center justify-center px-2.5 rounded-[10px] text-(--text-tertiary) hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                  onClick={() => handleDelete(page)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowCreateModal(true)}
            className="border border-dashed border-(--card-border) bg-(--card-bg) rounded-[14px] p-5 flex flex-col items-center justify-center gap-2 text-(--text-tertiary) hover:bg-[#FBB03B]/5 hover:border-[#FBB03B]/30 hover:text-[#FBB03B] transition-colors min-h-[120px] group cursor-pointer"
          >
            <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-[13px] font-medium">Nova página</span>
          </button>
        </div>
      )}

      {/* Modal criar página */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova página</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome da página</Label>
              <Input
                autoFocus
                placeholder="Ex: Página de captura"
                value={newPageNome}
                onChange={(e) => handleNomeChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug (URL)</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm shrink-0">/p/</span>
                <Input
                  value={newPageSlug}
                  onChange={(e) => { setSlugManual(true); setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")); }}
                  placeholder="minha-pagina"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={!newPageNome.trim() || createPage.isPending}
              style={{ backgroundColor: '#FBB03B', color: '#1A1A1A' }}
              className="font-semibold hover:opacity-90"
            >
              {createPage.isPending ? "Criando..." : "Criar e abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
