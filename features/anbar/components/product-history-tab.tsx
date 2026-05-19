"use client";

import { useState, useTransition } from "react";
import { History, User, Trash2, ChevronDown, ChevronRight, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { deleteProductHistoryEntry } from "@/features/anbar/product-history-actions";
import { formatDate } from "@/lib/utils";

type Entry = {
  id: string;
  yaradildi: Date | null | string;
  emeliyyat: string;
  istifadeci_ad: string | null;
  url: string | null;
  status: string | null;
  sebeb: string | null;
  changes: Array<{ field: string; from: unknown; to: unknown }>;
};

const EMELIYYAT_LABEL: Record<string, { label: string; cls: string }> = {
  yaradildi: { label: "Yaradıldı", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  yenilendi: { label: "Yeniləndi", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  silindi:   { label: "Silindi",   cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  baxildi:   { label: "Baxıldı",   cls: "bg-secondary text-muted-foreground border-border" },
};

const FIELD_LABELS: Record<string, string> = {
  ad: "Ad",
  kod: "Kod",
  barkod: "Barkod",
  alish_qiymeti: "Alış qiyməti",
  satis_qiymeti: "Satış qiyməti",
  min_satis_qiymeti: "Min satış qiyməti",
  topdan_qiymeti: "Topdan qiymət",
  vip_qiymeti: "VIP qiymət",
  partnyor_qiymeti: "Partnyor qiymət",
  endirimli_qiymet: "Endirimli qiymət",
  kritik_stok: "Kritik stok",
  kateqoriya_id: "Kateqoriya",
  marka_id: "Marka",
  model: "Model",
  aktiv: "Aktiv",
  sekil_url: "Şəkil",
  aciqlamaq: "Açıqlama",
};

function formatFieldName(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "number") return new Intl.NumberFormat("az-AZ").format(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function ProductHistoryTab({
  productId,
  entries,
  canDelete,
}: {
  productId: string;
  entries: Entry[];
  canDelete: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Bu məhsulda hələ ki tarixçə qeydi yoxdur.</p>
        <p className="mt-1 text-[10.5px] text-muted-foreground/70">
          Məhsul kartına edilmiş hər dəyişiklik avtomatik bu tarixçəyə düşür.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10.5px] text-muted-foreground">
          {entries.length} qeyd · son dəyişikliklər ən yuxarıda
        </p>
        {!canDelete && (
          <span className="text-[10px] text-muted-foreground/70">
            (Silmə icazəsi yoxdur — yalnız sahibkar/admin)
          </span>
        )}
      </div>
      <ol className="space-y-1.5">
        {entries.map((e) => (
          <HistoryRow key={e.id} entry={e} productId={productId} canDelete={canDelete} />
        ))}
      </ol>
    </div>
  );
}

function HistoryRow({
  entry,
  productId,
  canDelete,
}: {
  entry: Entry;
  productId: string;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deleted, setDeleted] = useState(false);

  if (deleted) return null;

  const meta = EMELIYYAT_LABEL[entry.emeliyyat] ?? {
    label: entry.emeliyyat,
    cls: "bg-secondary text-muted-foreground border-border",
  };
  const hasChanges = entry.changes.length > 0;

  const handleDelete = () => {
    if (!confirm("Bu tarixçə qeydini silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.")) return;
    startTransition(async () => {
      const result = await deleteProductHistoryEntry(productId, entry.id);
      if (result.ok) {
        setDeleted(true);
      } else {
        alert(result.error);
      }
    });
  };

  return (
    <li className="rounded-lg border border-border/40 bg-card/40 transition hover:border-primary/30">
      <div className="flex items-start gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => hasChanges && setOpen((v) => !v)}
          disabled={!hasChanges}
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground enabled:hover:bg-secondary enabled:hover:text-foreground disabled:opacity-30"
          aria-label="Detallar"
        >
          {hasChanges && (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>
              {meta.label}
            </Badge>
            {hasChanges && (
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {entry.changes.length} sahə
              </span>
            )}
            {entry.status === "xeta" && (
              <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-500">
                Xəta
              </Badge>
            )}
            <span className="ml-auto text-[10.5px] tabular-nums text-muted-foreground">
              {entry.yaradildi ? formatDate(entry.yaradildi) : "—"}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="h-2.5 w-2.5" />
              {entry.istifadeci_ad ?? "Sistem"}
            </span>
            {entry.url && (
              <span className="inline-flex items-center gap-1">
                <Globe className="h-2.5 w-2.5" />
                <code className="text-[10px]">{entry.url}</code>
              </span>
            )}
          </div>
          {entry.sebeb && (
            <p className="mt-1 text-[11px] italic text-muted-foreground">{entry.sebeb}</p>
          )}

          {open && hasChanges && (
            <div className="mt-2 space-y-1 rounded-md border border-border/30 bg-secondary/30 p-2">
              {entry.changes.map((c) => (
                <div key={c.field} className="grid grid-cols-[100px_1fr] gap-2 text-[11px]">
                  <div className="font-semibold text-foreground">{formatFieldName(c.field)}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <code className="rounded bg-rose-500/10 px-1 py-0.5 text-[10px] text-rose-600 line-through dark:text-rose-400">
                      {formatValue(c.from)}
                    </code>
                    <span className="text-muted-foreground">→</span>
                    <code className="rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                      {formatValue(c.to)}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            title="Tarixçə qeydini sil"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground/60 hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}
