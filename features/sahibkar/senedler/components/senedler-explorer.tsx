"use client";

import { useState, useTransition, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderPlus, Upload, Link as LinkIcon, Folder, FileText, Image as ImageIcon,
  FileSpreadsheet, File as FileGeneric, ChevronRight, MoreVertical, Trash2, Pencil,
  ExternalLink, Search, X, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  createFolder, renameFolder, deleteFolder, addLinkSened, deleteSened, updateSenedMeta,
} from "@/features/sahibkar/senedler/actions";
import type { SenedTree, SenedFayl } from "@/features/sahibkar/senedler/types";

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function iconForMime(mime: string, tip: "file" | "link"): React.ComponentType<{ className?: string }> {
  if (tip === "link") return ExternalLink;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  return FileGeneric;
}

export function SenedlerExplorer({
  tree,
  currentFolderId,
  breadcrumb,
}: {
  tree: SenedTree;
  currentFolderId: string | null;
  breadcrumb: Array<{ id: string | null; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  // Cari qovluqdakı alt qovluqlar və fayllar
  const currentFolders = useMemo(
    () => tree.folders.filter((f) => f.parent_id === currentFolderId),
    [tree.folders, currentFolderId],
  );
  const currentFiles = useMemo(
    () => tree.files.filter((f) => f.folder_id === currentFolderId),
    [tree.files, currentFolderId],
  );

  // Axtarış aktivdirsə bütün ağacda axtar
  const searchLower = search.trim().toLowerCase();
  const searchActive = searchLower.length > 0;
  const filteredFiles = searchActive
    ? tree.files.filter(
        (f) =>
          f.name.toLowerCase().includes(searchLower) ||
          f.qeyd.toLowerCase().includes(searchLower) ||
          f.tags.some((t) => t.toLowerCase().includes(searchLower)),
      )
    : currentFiles;
  const filteredFolders = searchActive
    ? tree.folders.filter((f) => f.name.toLowerCase().includes(searchLower))
    : currentFolders;

  function handleNewFolder() {
    const name = prompt("Qovluq adı:");
    if (!name) return;
    startTransition(async () => {
      const res = await createFolder({ name, parent_id: currentFolderId });
      if (res.ok) {
        toast.success("Qovluq yaradıldı");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function handleDeleteFolder(id: string, name: string) {
    if (!confirm(`"${name}" qovluğunu silmək istəyirsən? İçindəki bütün fayllar da silinəcək.`)) return;
    startTransition(async () => {
      const res = await deleteFolder({ id });
      if (res.ok) {
        toast.success("Qovluq silindi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function handleRenameFolder(id: string, oldName: string) {
    const name = prompt("Yeni ad:", oldName);
    if (!name || name === oldName) return;
    startTransition(async () => {
      const res = await renameFolder({ id, name });
      if (res.ok) {
        toast.success("Yeniləndi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function handleDeleteSened(s: SenedFayl) {
    if (!confirm(`"${s.name}" silinsin?`)) return;
    startTransition(async () => {
      const res = await deleteSened({ id: s.id });
      if (res.ok) {
        toast.success("Silindi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {/* Toolbar — breadcrumb + axtarış + əməliyyatlar */}
      <Card className="glass">
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          {/* Breadcrumb */}
          <nav className="flex flex-1 items-center gap-1 text-xs min-w-[200px]">
            {breadcrumb.map((b, i) => (
              <span key={String(b.id) + i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                {i === breadcrumb.length - 1 ? (
                  <span className="font-bold">{b.name}</span>
                ) : (
                  <Link
                    href={b.id ? `?folder=${b.id}` : "/sahibkar/senedler"}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {b.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          {/* Axtarış */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Bütün sənədlərdə axtar..."
              className="h-8 w-48 rounded-md border border-input bg-background pl-7 pr-7 text-xs"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Əməliyyatlar */}
          <Button variant="outline" size="sm" onClick={handleNewFolder} disabled={pending}>
            <FolderPlus className="h-3.5 w-3.5" />
            Yeni qovluq
          </Button>
          <UploadButton folderId={currentFolderId} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} />
          <LinkButton folderId={currentFolderId} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} />
        </CardContent>
      </Card>

      {searchActive && (
        <p className="px-1 text-[10.5px] text-muted-foreground">
          Axtarış: <strong className="text-foreground">«{search}»</strong> ·{" "}
          {filteredFolders.length} qovluq · {filteredFiles.length} sənəd
        </p>
      )}

      {/* Qovluqlar grid */}
      {filteredFolders.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredFolders.map((f) => (
            <Card key={f.id} className="glass group hover:border-primary/30">
              <CardContent className="flex items-center gap-2 px-3 py-3">
                <Link
                  href={`?folder=${f.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2 hover:text-primary"
                >
                  <Folder className="h-5 w-5 shrink-0 text-amber-500" />
                  <span className="truncate text-sm font-semibold">{f.name}</span>
                </Link>
                <div className="opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleRenameFolder(f.id, f.name)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
                    title="Adı dəyiş"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(f.id, f.name)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                    title="Sil"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Fayllar list */}
      {filteredFiles.length > 0 && (
        <Card className="glass">
          <CardContent className="divide-y divide-border/30 p-0">
            {filteredFiles.map((f) => {
              const Icon = iconForMime(f.mime, f.tip);
              const folder = f.folder_id ? tree.folders.find((x) => x.id === f.folder_id) : null;
              return (
                <div key={f.id} className="group flex flex-wrap items-center gap-3 px-3 py-2.5 hover:bg-secondary/20">
                  <Icon className={`h-4 w-4 shrink-0 ${f.tip === "link" ? "text-sky-500" : "text-muted-foreground"}`} />
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 hover:text-primary"
                  >
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    {f.qeyd && <div className="truncate text-[10.5px] text-muted-foreground">{f.qeyd}</div>}
                    {f.tags.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {f.tags.map((t, i) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </a>
                  {searchActive && folder && (
                    <Link href={`?folder=${folder.id}`} className="hidden text-[10px] text-muted-foreground hover:text-foreground sm:inline-flex items-center gap-0.5">
                      <Folder className="h-2.5 w-2.5" />
                      {folder.name}
                    </Link>
                  )}
                  <div className="text-[10.5px] tabular-nums text-muted-foreground">
                    {f.tip === "file" ? formatBytes(f.olcu_byte) : "link"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(f.yaradildi).toLocaleDateString("az-AZ")}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSened(f)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500"
                    title="Sil"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {filteredFolders.length === 0 && filteredFiles.length === 0 && (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <Folder className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold">Boş</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {searchActive
                ? `"${search}" üçün heç bir nəticə tapılmadı.`
                : "Yeni qovluq yarat və ya fayl yüklə."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UploadButton({
  folderId,
  pending,
  startTransition,
  onDone,
}: {
  folderId: string | null;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (folderId) fd.append("folder_id", folderId);
      const res = await fetch("/api/sahibkar/sened/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok) {
        toast.success("Yükləndi");
        onDone();
      } else toast.error(j.error ?? "Xəta");
    } catch {
      toast.error("Yükləmə xətası");
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            handleFile(f);
            e.target.value = "";
          }
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={pending || uploading}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        Fayl yüklə
      </Button>
    </>
  );
}

function LinkButton({
  folderId,
  pending,
  startTransition,
  onDone,
}: {
  folderId: string | null;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [qeyd, setQeyd] = useState("");
  const [tags, setTags] = useState("");

  function reset() {
    setName(""); setUrl(""); setQeyd(""); setTags("");
  }

  function onSubmit() {
    startTransition(async () => {
      const res = await addLinkSened({ folder_id: folderId, name, url, qeyd, tags });
      if (res.ok) {
        toast.success("Link əlavə edildi");
        reset();
        setOpen(false);
        onDone();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <LinkIcon className="h-3.5 w-3.5" />
          Link əlavə et
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Xarici link əlavə et</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold">Ad</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Misal: 2024 maliyyə hesabatı"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold">URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">Google Drive, Dropbox, OneDrive və s.</p>
          </div>
          <div>
            <label className="text-xs font-semibold">Qeyd (opsional)</label>
            <input
              value={qeyd}
              onChange={(e) => setQeyd(e.target.value)}
              placeholder="Qısa təsvir"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Etiketlər (vergüllə ayır)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="vergi, 2024, qaime"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
          <Button onClick={onSubmit} disabled={pending || !name || !url}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
            Əlavə et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
