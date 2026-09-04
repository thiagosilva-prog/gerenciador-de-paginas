import * as React from "react";
import { useNavigate } from "react-router";
import { Plus, FileText, Folder, FolderOpen, Globe, Trash2, Pencil, ExternalLink, LogOut, MoreVertical, ArrowLeft, FolderInput } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import {
  usePages, useCreatePage, useDeletePage, useUpdatePage, generateSlug, type Page,
  useFolders, useCreateFolder, useRenameFolder, useDeleteFolder, type PageFolder,
} from "../../hooks/usePages";
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

  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);
  const [folderDialog, setFolderDialog] = React.useState<{ mode: "create" | "rename"; folder?: PageFolder } | null>(null);
  const [folderNome, setFolderNome] = React.useState("");
  const [confirmDialog, setConfirmDialog] = React.useState<
    | { type: "page"; page: Page }
    | { type: "folder"; folder: PageFolder }
    | null
  >(null);

  const { data: paginas = [], isLoading } = usePages();
  const { data: folders = [], isLoading: isLoadingFolders } = useFolders();

  const createPage = useCreatePage();
  const deletePage = useDeletePage();
  const updatePage = useUpdatePage();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();

  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : undefined;
  const visiblePages = paginas.filter(p => (p.folder_id ?? null) === currentFolderId);

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
      if (currentFolderId) {
        await updatePage.mutateAsync({ id: page.id, folder_id: currentFolderId });
      }
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

  const handleDelete = (page: Page) => {
    setConfirmDialog({ type: "page", page });
  };

  const handleMovePage = async (page: Page, folderId: string | null) => {
    try {
      await updatePage.mutateAsync({ id: page.id, folder_id: folderId });
      toast.success(folderId ? "Página movida para a pasta" : "Página removida da pasta");
    } catch {
      toast.error("Erro ao mover página");
    }
  };

  const handleSaveFolder = async () => {
    if (!folderNome.trim() || !folderDialog) return;
    try {
      if (folderDialog.mode === "create") {
        await createFolder.mutateAsync({ nome: folderNome.trim() });
        toast.success("Pasta criada!");
      } else if (folderDialog.folder) {
        await renameFolder.mutateAsync({ id: folderDialog.folder.id, nome: folderNome.trim() });
        toast.success("Pasta renomeada!");
      }
      setFolderDialog(null);
      setFolderNome("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar pasta");
    }
  };

  const handleDeleteFolder = (folder: PageFolder) => {
    setConfirmDialog({ type: "folder", folder });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDialog) return;
    try {
      if (confirmDialog.type === "page") {
        await deletePage.mutateAsync({ id: confirmDialog.page.id });
        toast.success("Página excluída");
      } else {
        await deleteFolder.mutateAsync({ id: confirmDialog.folder.id });
        toast.success("Pasta excluída");
        if (currentFolderId === confirmDialog.folder.id) setCurrentFolderId(null);
      }
    } catch {
      toast.error(confirmDialog.type === "page" ? "Erro ao excluir" : "Erro ao excluir pasta");
    } finally {
      setConfirmDialog(null);
    }
  };

  const loading = isLoading || isLoadingFolders;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {currentFolderId ? (
              <button
                onClick={() => setCurrentFolderId(null)}
                title="Voltar para Páginas"
                className="h-8 w-8 flex items-center justify-center text-(--text-tertiary) hover:text-(--text-primary) hover:bg-(--card-hover) rounded-2xl border border-(--card-border) transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <FileText className="w-5 h-5 text-(--text-tertiary)" />
            )}
            <h2 className="text-[22px] font-semibold text-(--text-primary)" style={{ letterSpacing: '-0.374px' }}>
              {currentFolder ? currentFolder.nome : "Páginas"}
            </h2>
          </div>
          <p className="text-[13px] text-(--text-secondary) mt-1">
            {currentFolder ? "Páginas / " + currentFolder.nome : "Gerencie suas landing pages"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!currentFolderId && (
            <Button
              variant="outline"
              onClick={() => { setFolderDialog({ mode: "create" }); setFolderNome(""); }}
              className="h-10 px-4 text-[13px] rounded-2xl"
            >
              <Folder className="h-3.5 w-3.5 mr-1.5" />
              Nova pasta
            </Button>
          )}
          <Button
            onClick={() => setShowCreateModal(true)}
            className="btn-brand h-10 px-4 text-[13px] rounded-2xl"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nova página
          </Button>
          <button
            title="Sair"
            onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
            className="h-10 w-10 flex items-center justify-center text-(--text-tertiary) hover:text-(--text-primary) hover:bg-(--card-hover) rounded-2xl border border-(--card-border) transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="max-w-3xl mx-auto space-y-3">
          {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-20 rounded-xl" />)}
        </div>
      ) : visiblePages.length === 0 && (currentFolderId || folders.length === 0) ? (
        <div className="max-w-3xl mx-auto flex flex-col items-center justify-center py-24 text-center border-dashed bg-(--card-bg) border border-(--card-border) rounded-[14px]">
          <div className="h-14 w-14 rounded-full bg-(--card-hover) border border-(--card-border) flex items-center justify-center mb-4">
            <Globe className="h-6 w-6 text-(--text-tertiary)" />
          </div>
          <h3 className="text-[15px] font-semibold text-(--text-primary) mb-1">
            {currentFolderId ? "Nenhuma página nesta pasta" : "Nenhuma página criada ainda"}
          </h3>
          <p className="text-[13px] text-(--text-tertiary) mb-6 max-w-sm">Crie sua primeira landing page.</p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="btn-brand h-10 px-4 text-[13px] rounded-2xl"
          >
            Criar primeira página
          </Button>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-2">
          {!currentFolderId && folders.map(folder => (
            <div
              key={folder.id}
              className="bg-(--card-bg) border border-(--card-border) rounded-[14px] hover:border-[#FBB03B]/30 hover:bg-[#FBB03B]/5 transition-colors cursor-pointer group flex items-center gap-3 p-3.5"
              onClick={() => setCurrentFolderId(folder.id)}
            >
              <div className="h-10 w-10 rounded-[10px] bg-(--card-hover) flex items-center justify-center shrink-0">
                <FolderOpen className="h-5 w-5 text-[#FBB03B]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[15px] text-(--text-primary) mb-0.5 truncate" style={{ letterSpacing: '-0.2px' }}>{folder.nome}</h3>
                <p className="text-[12px] text-(--text-tertiary)">{paginas.filter(p => p.folder_id === folder.id).length} página{paginas.filter(p => p.folder_id === folder.id).length === 1 ? "" : "s"}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-8 w-8 flex items-center justify-center text-(--text-tertiary) hover:text-(--text-primary) hover:bg-(--card-hover) rounded-2xl transition-colors shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => { setFolderDialog({ mode: "rename", folder }); setFolderNome(folder.nome); }}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Renomear pasta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDeleteFolder(folder)} className="text-red-500 focus:text-red-500">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir pasta
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {visiblePages.map(page => (
            <div
              key={page.id}
              className="bg-(--card-bg) border border-(--card-border) rounded-[14px] hover:border-[#FBB03B]/30 hover:bg-[#FBB03B]/5 transition-colors cursor-pointer group p-3.5 flex items-center gap-4"
              onClick={() => navigate(`/pages/${page.id}`)}
            >
              <div className="flex-1 min-w-0 flex items-center gap-3">
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

              <p className="text-[12px] text-(--text-tertiary) shrink-0 hidden sm:block">
                Atualizada {formatDistanceToNow(new Date(page.atualizado_em), { locale: ptBR, addSuffix: true })}
              </p>

              <div
                className="flex gap-2 shrink-0"
                onClick={e => e.stopPropagation()}
              >
                <button
                  className="h-10 flex items-center justify-center gap-1.5 px-3 rounded-2xl border border-(--card-border) text-[13px] font-medium text-(--text-secondary) bg-transparent hover:bg-(--card-hover) hover:text-(--text-primary) transition-colors cursor-pointer"
                  onClick={() => navigate(`/pages/${page.id}`)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {page.status === "published" && (
                  <a
                    href={`/p/${page.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 flex items-center justify-center rounded-2xl border border-(--card-border) text-(--text-secondary) hover:bg-(--card-hover) hover:text-(--text-primary) transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-10 w-10 flex items-center justify-center rounded-2xl border border-(--card-border) text-(--text-secondary) hover:bg-(--card-hover) hover:text-(--text-primary) transition-colors cursor-pointer">
                      <FolderInput className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {folders.length === 0 ? (
                      <DropdownMenuItem disabled>Nenhuma pasta criada</DropdownMenuItem>
                    ) : (
                      folders.map(folder => (
                        <DropdownMenuItem
                          key={folder.id}
                          disabled={page.folder_id === folder.id}
                          onClick={() => handleMovePage(page, folder.id)}
                        >
                          <Folder className="w-3.5 h-3.5 mr-2" /> {folder.nome}
                        </DropdownMenuItem>
                      ))
                    )}
                    {page.folder_id && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleMovePage(page, null)}>
                          Remover da pasta
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  className="h-10 w-10 flex items-center justify-center rounded-2xl text-(--text-tertiary) hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                  onClick={() => handleDelete(page)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowCreateModal(true)}
            className="border border-dashed border-(--card-border) bg-(--card-bg) rounded-[14px] flex items-center justify-center gap-2 text-(--text-tertiary) hover:bg-[#FBB03B]/5 hover:border-[#FBB03B]/30 hover:text-[#FBB03B] transition-colors group cursor-pointer p-3.5"
          >
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
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

      {/* Modal criar/renomear pasta */}
      <Dialog open={!!folderDialog} onOpenChange={(open) => !open && setFolderDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{folderDialog?.mode === "rename" ? "Renomear pasta" : "Nova pasta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome da pasta</Label>
              <Input
                autoFocus
                placeholder="Ex: Campanhas 2026"
                value={folderNome}
                onChange={(e) => setFolderNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveFolder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog(null)}>Cancelar</Button>
            <Button
              onClick={handleSaveFolder}
              disabled={!folderNome.trim() || createFolder.isPending || renameFolder.isPending}
              style={{ backgroundColor: '#FBB03B', color: '#1A1A1A' }}
              className="font-semibold hover:opacity-90"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal confirmar exclusão */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === "folder" ? "Excluir pasta" : "Excluir página"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === "folder"
                ? `Excluir a pasta "${confirmDialog.folder.nome}"? As páginas dentro dela voltam para a raiz.`
                : confirmDialog?.type === "page"
                ? `Excluir "${confirmDialog.page.nome}"? Essa ação não pode ser desfeita.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deletePage.isPending || deleteFolder.isPending}
              className="bg-red-500 text-white hover:bg-red-600 font-semibold"
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
