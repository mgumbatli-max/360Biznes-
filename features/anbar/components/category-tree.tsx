"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers,
  Package,
  ChevronRight,
  Search,
  X,
  Eye,
  EyeOff,
  Trash2,
  Pencil,
  Plus,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { deleteKateqoriya, renameKateqoriya, createKateqoriya } from "../kateqoriya-actions";

export type CategoryNode = {
  id: number;
  ad: string;
  ust_id: number | null;
  product_count: number;
  children: CategoryNode[];
};

type Props = {
  tree: CategoryNode[];
  /** Cari istifadəçi kataloqu redaktə edə bilirmi (sahibkar/admin və ya icazəli). */
  canEdit?: boolean;
};

export function CategoryTree({ tree, canEdit = false }: Props) {
  const [query, setQuery] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    // Default — yalnız ən üst səviyyə açıqdır
    const init: Record<number, boolean> = {};
    for (const n of tree) init[n.id] = false;
    return init;
  });

  const filtered = useMemo(() => filterTree(tree, query.trim().toLowerCase(), hideEmpty), [tree, query, hideEmpty]);

  function toggle(id: number) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }
  function expandAll() {
    const all: Record<number, boolean> = {};
    const walk = (ns: CategoryNode[]) => {
      for (const n of ns) {
        all[n.id] = true;
        walk(n.children);
      }
    };
    walk(tree);
    setExpanded(all);
  }
  function collapseAll() {
    setExpanded({});
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kateqoriya ağacında axtar..."
            className="h-9 pl-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Axtarışı təmizlə"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setHideEmpty((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
            hideEmpty
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          {hideEmpty ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {hideEmpty ? "Boşlar gizli" : "Boşları göstər"}
        </button>
        <button
          type="button"
          onClick={expandAll}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Hamısını aç
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Hamısını bağla
        </button>
      </div>

      {/* Tree */}
      <div className="rounded-xl border border-border bg-card/40">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Layers className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {query ? `"${query}" tapılmadı` : "Kateqoriya yoxdur"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {filtered.map((n) => (
              <CategoryRow
                key={n.id}
                node={n}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                highlight={query}
                canEdit={canEdit}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  node,
  depth,
  expanded,
  onToggle,
  highlight,
  canEdit,
}: {
  node: CategoryNode;
  depth: number;
  expanded: Record<number, boolean>;
  onToggle: (id: number) => void;
  highlight: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.ad);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<HTMLInputElement>(null);

  const hasChildren = node.children.length > 0;
  const isOpen = !!expanded[node.id];
  const canDelete = node.product_count === 0 && !hasChildren;

  function startRename() {
    setRenameValue(node.ad);
    setRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 30);
  }
  function commitRename() {
    const v = renameValue.trim();
    if (!v || v === node.ad) {
      setRenaming(false);
      return;
    }
    startTransition(async () => {
      const r = await renameKateqoriya(node.id, v);
      if (r.ok) {
        toast.success("Adı dəyişdi");
        setRenaming(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function startAddChild() {
    setChildName("");
    setAddingChild(true);
    if (!isOpen) onToggle(node.id);
    setTimeout(() => childInputRef.current?.focus(), 30);
  }
  function commitAddChild() {
    const v = childName.trim();
    if (!v) {
      setAddingChild(false);
      return;
    }
    const fd = new FormData();
    fd.set("ad", v);
    fd.set("ust_id", String(node.id));
    startTransition(async () => {
      const r = await createKateqoriya(fd);
      if (r.ok) {
        toast.success("Alt-kateqoriya əlavə olundu");
        setChildName("");
        setAddingChild(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function onDelete() {
    if (!confirm(`"${node.ad}" silinsin?`)) return;
    startTransition(async () => {
      const r = await deleteKateqoriya(node.id);
      if (r.ok) {
        toast.success("Silindi");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <li>
      <div
        className="group flex items-center gap-2 px-3 py-2 hover:bg-secondary/30"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-label={isOpen ? "Bağla" : "Aç"}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <Layers className={`h-3.5 w-3.5 shrink-0 ${depth === 0 ? "text-violet-500" : "text-muted-foreground"}`} />

        {renaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              onBlur={commitRename}
              disabled={pending}
              className="h-7 text-sm"
              maxLength={100}
            />
            <button
              type="button"
              onClick={commitRename}
              disabled={pending}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-500/10"
              title="Saxla (Enter)"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Link
            href={`/anbar/mehsullar?kateq=${node.id}`}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
            onDoubleClick={(e) => {
              if (canEdit) {
                e.preventDefault();
                startRename();
              }
            }}
            title={canEdit ? "İkiqat klik ilə adı dəyişdir" : node.ad}
          >
            {renderHighlighted(node.ad, highlight)}
          </Link>
        )}

        <Badge variant="outline" className="text-[10px]" title="Bu kateqoriyada birbaşa məhsul sayı">
          <Package className="mr-0.5 h-2.5 w-2.5" />
          {node.product_count}
        </Badge>
        {hasChildren && (
          <Badge variant="outline" className="text-[10px]" title="Alt-kateqoriya sayı">
            {node.children.length} alt
          </Badge>
        )}

        {canEdit && !renaming && (
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={startRename}
              disabled={pending}
              title="Adı dəyişdir"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={startAddChild}
              disabled={pending}
              title="Alt-kateqoriya əlavə et"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={!canDelete || pending}
              title={canDelete ? "Sil" : "Məhsul və ya alt-kateqoriya var"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Inline alt-kateqoriya input */}
      {addingChild && (
        <div
          className="flex items-center gap-1 bg-emerald-500/5 py-1.5 pr-3"
          style={{ paddingLeft: `${12 + (depth + 1) * 20}px` }}
        >
          <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <Input
            ref={childInputRef}
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAddChild();
              if (e.key === "Escape") setAddingChild(false);
            }}
            onBlur={() => {
              if (!childName.trim()) setAddingChild(false);
            }}
            placeholder="Yeni alt-kateqoriya adı..."
            disabled={pending}
            className="h-7 text-sm"
            maxLength={100}
          />
          <button
            type="button"
            onClick={commitAddChild}
            disabled={pending || !childName.trim()}
            className="rounded bg-emerald-600 px-2 py-1 text-[10.5px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Əlavə et
          </button>
          <button
            type="button"
            onClick={() => setAddingChild(false)}
            disabled={pending}
            className="rounded p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {hasChildren && isOpen && (
        <ul className="divide-y divide-border/20 bg-secondary/10">
          {node.children.map((c) => (
            <CategoryRow
              key={c.id}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              highlight={highlight}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function renderHighlighted(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-500/30 px-0.5 text-foreground">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/** Recursively filter the tree — keep nodes that match OR have a matching descendant. */
function filterTree(nodes: CategoryNode[], query: string, hideEmpty: boolean): CategoryNode[] {
  const visit = (n: CategoryNode): CategoryNode | null => {
    const kids = n.children.map(visit).filter(Boolean) as CategoryNode[];
    const matches = !query || n.ad.toLowerCase().includes(query);
    const empty = n.product_count === 0 && kids.length === 0;
    if (hideEmpty && empty) return null;
    if (matches || kids.length > 0) {
      return { ...n, children: kids };
    }
    return null;
  };
  return nodes.map(visit).filter(Boolean) as CategoryNode[];
}
