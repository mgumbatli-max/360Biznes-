"use client";

import { useTransition, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Trash2, ArrowUp, ArrowDown, ArrowUpDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductDialog } from "./product-dialog";
import { QuickViewDialog } from "./quick-view-dialog";
import { BulkActionsBar } from "./bulk-actions-bar";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { deleteProduct } from "../actions";
import { Inspect } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn, formatMoney, formatNumber } from "@/lib/utils";
import type { ProductListRow } from "../queries";

type Props = {
  items: ProductListRow[];
  total: number;
  categories: Array<{ id: number; ad: string }>;
  brands: Array<{ id: number; ad: string }>;
  units?: Array<{ id: number; ad: string; qisa_ad?: string | null }>;
  anbarlar?: Array<{ id: number; ad: string }>;
};

type SortKey = "ad" | "kod" | "alish_qiymeti" | "satis_qiymeti" | "stok_miqdari" | "margin";
type SortDir = "asc" | "desc";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "sekil",       label: "Şəkil" },
  { key: "mehsul",      label: "Məhsul (ad)",         required: true },
  { key: "kod",         label: "Kod (SKU)" },
  { key: "barkod",      label: "Barkod" },
  { key: "alt_kateq",   label: "Alt kataloq" },
  { key: "kateqoriya",  label: "Kateqoriya / Marka" },
  { key: "model",       label: "Model" },
  { key: "rang",        label: "Rəng" },
  { key: "istehsalci",  label: "İstehsalçı" },
  { key: "olcu",        label: "Ölçü vahidi" },
  { key: "cheki",       label: "Çəki (kq)" },
  { key: "hecm",        label: "Həcm (m³)" },
  { key: "olculer",     label: "Ölçülər" },
  { key: "qutu",        label: "Qutu say" },
  { key: "alish",       label: "Maya (alış)" },
  { key: "satis",       label: "Satış qiyməti" },
  { key: "endirim",     label: "Endirimli qiymət" },
  { key: "min_satis",   label: "Min satış" },
  { key: "topdan",      label: "Topdan / VIP" },
  { key: "partnyor",    label: "Partnyor qiymət" },
  { key: "komissiya",   label: "Komissiya %" },
  { key: "valyuta",     label: "Valyuta" },
  { key: "edv",         label: "ƏDV statusu" },
  { key: "marja",       label: "Marja" },
  { key: "stok",        label: "Stok" },
  { key: "kritik",      label: "Kritik / Min / Max" },
  { key: "anbar_sayi",  label: "Anbar sayı" },
  { key: "zemanet",     label: "Zəmanət (ay)" },
  { key: "serial",      label: "Serial / IMEI" },
  { key: "aciqlama",    label: "Məhsul haqqında" },
  { key: "qisa_tesvir", label: "Qısaca təsvir" },
  { key: "servis",      label: "Servis rəyi" },
  { key: "yaradildi",   label: "Yaradıldı" },
  { key: "son_satis",   label: "Son satış" },
  { key: "etiketsiz",   label: "Etiketsiz" },
  { key: "status",      label: "Status" },
];
const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

// Yeni istifadəçi üçün default 8 əsas sütun (qalanlar "Sütunlar" menyusundan açılır)
const DEFAULT_VISIBLE = [
  "sekil",
  "mehsul",
  "kateqoriya",
  "alish",
  "satis",
  "marja",
  "stok",
  "status",
];

export function ProductTable({ items, total, categories, brands, units = [] }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const cols = useColumnToggle("anbar-mehsullar-cols-v4", COLUMN_DEFS, DEFAULT_ORDER, DEFAULT_VISIBLE);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sortBy = (sp.get("sort") as SortKey) ?? "ad";
  const sortDir = (sp.get("dir") as SortDir) ?? "asc";

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const allSelected = items.length > 0 && items.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (items.every((p) => prev.has(p.id))) {
        const next = new Set(prev);
        for (const p of items) next.delete(p.id);
        return next;
      }
      const next = new Set(prev);
      for (const p of items) next.add(p.id);
      return next;
    });
  }
  function clearSel() { setSelected(new Set()); }

  function setSort(key: SortKey) {
    const newDir: SortDir = sortBy === key && sortDir === "asc" ? "desc" : "asc";
    const params = new URLSearchParams(sp.toString());
    params.set("sort", key);
    params.set("dir", newDir);
    params.set("page", "1");
    router.push(`/anbar/mehsullar?${params.toString()}`);
  }

  function onDelete(id: string, ad: string) {
    if (!confirm(`"${ad}" silinsin (deaktivləşdirilsin)?`)) return;
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (res.ok) {
        toast.success("Silindi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">Məhsul tapılmadı</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Filtrlərə uyğun məhsul yoxdur. Filtrləri sıfırlayın və ya yeni məhsul əlavə edin.
        </p>
      </div>
    );
  }

  // Client-side sort (server already returns by ad — re-sort by other keys here)
  const sorted = [...items].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const aMargin = a.alish_qiymeti > 0 ? ((a.satis_qiymeti - a.alish_qiymeti) / a.alish_qiymeti) * 100 : 0;
    const bMargin = b.alish_qiymeti > 0 ? ((b.satis_qiymeti - b.alish_qiymeti) / b.alish_qiymeti) * 100 : 0;
    switch (sortBy) {
      case "ad": return a.ad.localeCompare(b.ad, "az") * dir;
      case "kod": return (a.kod ?? "").localeCompare(b.kod ?? "", "az") * dir;
      case "alish_qiymeti": return (a.alish_qiymeti - b.alish_qiymeti) * dir;
      case "satis_qiymeti": return (a.satis_qiymeti - b.satis_qiymeti) * dir;
      case "stok_miqdari": return (a.stok_miqdari - b.stok_miqdari) * dir;
      case "margin": return (aMargin - bMargin) * dir;
      default: return 0;
    }
  });

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Məhsullar <span className="ml-2 text-xs font-normal text-muted-foreground">{total} qeyd</span>
        </h3>
        <div className="flex items-center gap-1.5">
          {cols.render()}
          <a
            href={`/api/anbar/mehsullar/export?${sp.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            target="_blank"
            rel="noopener"
          >
            <ExternalLink className="h-3 w-3" /> Excel export
          </a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-card/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-20 bg-card/95 px-3 py-2.5 w-8 backdrop-blur">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Hamısını seç"
                  className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-primary"
                />
              </th>
              {cols.order.map((key) => {
                if (!cols.isVisible(key)) return null;
                switch (key) {
                  case "sekil":      return <th key={key} className="px-3 py-2.5 w-12">Şəkil</th>;
                  case "mehsul":     return (
                    <th key={key} className="sticky left-8 z-20 bg-card/95 px-3 py-2.5 min-w-[220px] backdrop-blur border-r border-border/40">
                      <SortableThInner label="Ad" current={sortBy} sortKey="ad" dir={sortDir} onClick={setSort} />
                    </th>
                  );
                  case "kod":        return <th key={key} className="px-3 py-2.5">Kod (SKU)</th>;
                  case "barkod":     return <th key={key} className="px-3 py-2.5">Barkod</th>;
                  case "alt_kateq":  return <th key={key} className="px-3 py-2.5">Alt kataloq</th>;
                  case "kateqoriya": return <th key={key} className="px-3 py-2.5">Kateqoriya / Marka</th>;
                  case "model":      return <th key={key} className="px-3 py-2.5">Model</th>;
                  case "rang":       return <th key={key} className="px-3 py-2.5">Rəng</th>;
                  case "istehsalci": return <th key={key} className="px-3 py-2.5">İstehsalçı</th>;
                  case "olcu":       return <th key={key} className="px-3 py-2.5">Ölçü</th>;
                  case "cheki":      return <th key={key} className="px-3 py-2.5 text-right">Çəki kq</th>;
                  case "hecm":       return <th key={key} className="px-3 py-2.5 text-right">Həcm m³</th>;
                  case "olculer":    return <th key={key} className="px-3 py-2.5">Ölçülər</th>;
                  case "qutu":       return <th key={key} className="px-3 py-2.5 text-right">Qutu</th>;
                  case "alish":      return <SortableTh key={key} label="Maya" current={sortBy} sortKey="alish_qiymeti" dir={sortDir} onClick={setSort} align="right" />;
                  case "satis":      return <SortableTh key={key} label="Satış" current={sortBy} sortKey="satis_qiymeti" dir={sortDir} onClick={setSort} align="right" />;
                  case "endirim":    return <th key={key} className="px-3 py-2.5 text-right">Endirim</th>;
                  case "min_satis":  return <th key={key} className="px-3 py-2.5 text-right">Min satış</th>;
                  case "topdan":     return <th key={key} className="px-3 py-2.5 text-right">Topdan / VIP</th>;
                  case "partnyor":   return <th key={key} className="px-3 py-2.5 text-right">Partnyor</th>;
                  case "komissiya":  return <th key={key} className="px-3 py-2.5 text-right">Kom %</th>;
                  case "valyuta":    return <th key={key} className="px-3 py-2.5">Valyuta</th>;
                  case "edv":        return <th key={key} className="px-3 py-2.5">ƏDV</th>;
                  case "marja":      return <SortableTh key={key} label="Margin" current={sortBy} sortKey="margin" dir={sortDir} onClick={setSort} align="right" />;
                  case "stok":       return <SortableTh key={key} label="Stok" current={sortBy} sortKey="stok_miqdari" dir={sortDir} onClick={setSort} align="right" />;
                  case "kritik":     return <th key={key} className="px-3 py-2.5 text-right">Kritik/Min/Max</th>;
                  case "anbar_sayi": return <th key={key} className="px-3 py-2.5 text-right">Anbar sayı</th>;
                  case "zemanet":    return <th key={key} className="px-3 py-2.5 text-right">Zəmanət</th>;
                  case "serial":     return <th key={key} className="px-3 py-2.5">S/N · IMEI</th>;
                  case "aciqlama":   return <th key={key} className="px-3 py-2.5">Məhsul haqqında</th>;
                  case "qisa_tesvir":return <th key={key} className="px-3 py-2.5">Qısa təsvir</th>;
                  case "servis":     return <th key={key} className="px-3 py-2.5 text-right">Servis</th>;
                  case "yaradildi":  return <th key={key} className="px-3 py-2.5">Yaradıldı</th>;
                  case "son_satis":  return <th key={key} className="px-3 py-2.5">Son satış</th>;
                  case "etiketsiz":  return <th key={key} className="px-3 py-2.5">Etiketsiz</th>;
                  case "status":     return <th key={key} className="px-3 py-2.5">Status</th>;
                  default: return null;
                }
              })}
              <th className="px-3 py-2.5 text-right w-28">Əməl</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const margin = p.alish_qiymeti > 0 ? ((p.satis_qiymeti - p.alish_qiymeti) / p.alish_qiymeti) * 100 : 0;
              const lowStock = p.kritik_stok != null && p.stok_miqdari > 0 && p.stok_miqdari <= p.kritik_stok;
              const outStock = p.stok_miqdari <= 0;
              const cells: Record<string, React.ReactNode> = {
                sekil: (
                  <td key="sekil" className="px-3 py-2.5">
                    {p.sekil_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.sekil_url} alt={p.ad} className="h-12 w-12 rounded-md object-cover border border-border/40" />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-md bg-secondary text-muted-foreground">
                        <Package className="h-4 w-4 opacity-50" />
                      </div>
                    )}
                  </td>
                ),
                mehsul: (
                  <td key="mehsul" className="sticky left-8 z-10 bg-background px-3 py-2.5 min-w-[220px] border-r border-border/40 group-hover:bg-secondary/40">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate font-medium" title={p.ad}>{p.ad}</span>
                        <CopyButton value={p.ad} title="Adı kopya et" size="xs" />
                        <button
                          type="button"
                          onClick={() => setQuickViewId(p.id)}
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-primary/15 hover:text-primary-light"
                          title="Sürətli baxış"
                          aria-label="Sürətli baxış"
                        >
                          <Inspect className="h-3 w-3" />
                        </button>
                      </div>
                      {!cols.isVisible("barkod") && (
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {p.kod && (
                            <span className="inline-flex items-center gap-0.5">
                              <span className="font-mono">{p.kod}</span>
                              <CopyButton value={p.kod} title="Kodu kopya et" size="xs" />
                            </span>
                          )}
                          {p.barkod && (
                            <span className="inline-flex items-center gap-0.5">
                              <span className="font-mono text-[10px]">{p.barkod}</span>
                              <CopyButton value={p.barkod} title="Barkodu kopya et" size="xs" />
                            </span>
                          )}
                          {!p.aktiv && !cols.isVisible("status") && <Badge variant="outline" className="text-[10px]">passiv</Badge>}
                        </div>
                      )}
                    </div>
                  </td>
                ),
                barkod: (
                  <td key="barkod" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p.barkod ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="font-mono">{p.barkod}</span>
                        <CopyButton value={p.barkod} title="Barkodu kopya et" size="xs" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                alt_kateq: (
                  <td key="alt_kateq" className="px-3 py-2.5 text-xs">
                    {p.kateqoriya_ust_ad ? (
                      <span title={`${p.kateqoriya_ust_ad} / ${p.kateqoriya_ad}`}>
                        <span className="text-muted-foreground">{p.kateqoriya_ust_ad}</span>
                        <span className="mx-1 text-muted-foreground/50">/</span>
                        <span>{p.kateqoriya_ad}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{p.kateqoriya_ad ?? "—"}</span>
                    )}
                  </td>
                ),
                anbar_sayi: (
                  <td key="anbar_sayi" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {p.anbar_sayi > 0 ? (
                      <span className="font-semibold">{p.anbar_sayi}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                ),
                aciqlama: (
                  <td key="aciqlama" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p.aciqlamaq ? (
                      <span className="line-clamp-2 max-w-xs" title={p.aciqlamaq}>{p.aciqlamaq}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                servis: (
                  <td key="servis" className="px-3 py-2.5 text-right">
                    {p.servis_sayi > 0 ? (
                      <Link href={`/servis?q=${encodeURIComponent(p.ad)}`} className="inline-flex items-center gap-1 text-xs hover:text-primary">
                        <span className="font-semibold tabular-nums">{p.servis_sayi}</span>
                        <span className="text-[10px] text-muted-foreground">qeyd</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                status: (
                  <td key="status" className="px-3 py-2.5">
                    {p.aktiv ? (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Aktiv</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Passiv</Badge>
                    )}
                  </td>
                ),
                kateqoriya: (
                  <td key="kateqoriya" className="px-3 py-2.5 text-xs text-muted-foreground">
                    <div>{p.kateqoriya_ad ?? "—"}</div>
                    <div>{p.marka_ad ?? "—"}</div>
                  </td>
                ),
                alish: (
                  <td key="alish" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {p.alish_qiymeti > 0 ? formatMoney(p.alish_qiymeti) : "—"}
                  </td>
                ),
                satis: (
                  <td key="satis" className="px-3 py-2.5 text-right tabular-nums font-medium">{formatMoney(p.satis_qiymeti)}</td>
                ),
                topdan: (
                  <td key="topdan" className="px-3 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                    <div>{p.topdan_qiymeti > 0 ? formatMoney(p.topdan_qiymeti) : "—"}</div>
                    <div className="text-[10px]">{p.vip_qiymeti > 0 ? formatMoney(p.vip_qiymeti) : "—"}</div>
                  </td>
                ),
                marja: (
                  <td key="marja" className="px-3 py-2.5 text-right">
                    {p.alish_qiymeti > 0 ? (
                      <span
                        className={`tabular-nums text-xs font-medium ${margin < 0 ? "text-danger" : margin < 10 ? "text-warning" : "text-success"}`}
                      >
                        {margin.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                stok: (
                  <td key="stok" className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`tabular-nums font-medium ${outStock ? "text-danger" : lowStock ? "text-warning" : ""}`}>
                        {formatNumber(p.stok_miqdari, 0)}
                      </span>
                      {outStock && (
                        <Badge variant="destructive" className="h-5 text-[10px]">bitib</Badge>
                      )}
                      {lowStock && !outStock && (
                        <Badge variant="secondary" className="h-5 bg-warning/15 text-warning text-[10px]">az</Badge>
                      )}
                    </div>
                  </td>
                ),
                kod: (
                  <td key="kod" className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {p.kod ? <span className="inline-flex items-center gap-0.5">{p.kod}<CopyButton value={p.kod} title="Kod" size="xs" /></span> : "—"}
                  </td>
                ),
                model: (
                  <td key="model" className="px-3 py-2.5 text-xs">{p.model ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                rang: (
                  <td key="rang" className="px-3 py-2.5 text-xs">{p.rang ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                istehsalci: (
                  <td key="istehsalci" className="px-3 py-2.5 text-xs">{p.istehsalci ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                olcu: (
                  <td key="olcu" className="px-3 py-2.5 text-xs">{p.olcu_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                cheki: (
                  <td key="cheki" className="px-3 py-2.5 text-right text-xs tabular-nums">{p.cheki_kg ? formatNumber(p.cheki_kg, 2) : <span className="text-muted-foreground">—</span>}</td>
                ),
                hecm: (
                  <td key="hecm" className="px-3 py-2.5 text-right text-xs tabular-nums">{p.hecm_m3 ? formatNumber(p.hecm_m3, 3) : <span className="text-muted-foreground">—</span>}</td>
                ),
                olculer: (
                  <td key="olculer" className="px-3 py-2.5 text-xs">{p.olculer ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                qutu: (
                  <td key="qutu" className="px-3 py-2.5 text-right text-xs tabular-nums">{p.qutu_say ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                endirim: (
                  <td key="endirim" className="px-3 py-2.5 text-right text-xs tabular-nums">
                    {p.endirimli_qiymet ? <span className="text-warning">{formatMoney(p.endirimli_qiymet)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                min_satis: (
                  <td key="min_satis" className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {p.min_satis_qiymeti > 0 ? formatMoney(p.min_satis_qiymeti) : "—"}
                  </td>
                ),
                partnyor: (
                  <td key="partnyor" className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {p.partnyor_qiymeti > 0 ? formatMoney(p.partnyor_qiymeti) : "—"}
                  </td>
                ),
                komissiya: (
                  <td key="komissiya" className="px-3 py-2.5 text-right text-xs tabular-nums">{p.komissiya_faiz > 0 ? `${p.komissiya_faiz.toFixed(2)}%` : <span className="text-muted-foreground">—</span>}</td>
                ),
                valyuta: (
                  <td key="valyuta" className="px-3 py-2.5 text-xs">{p.valyuta}</td>
                ),
                edv: (
                  <td key="edv" className="px-3 py-2.5 text-xs">
                    {p.edv_status === "edv_var" && <Badge variant="outline" className="text-[10px]">ƏDV 18%</Badge>}
                    {p.edv_status === "edv_yox" && <Badge variant="outline" className="text-[10px] text-muted-foreground">ƏDV yox</Badge>}
                    {p.edv_status === "edv_azad" && <Badge variant="outline" className="text-[10px] text-info">Azad</Badge>}
                  </td>
                ),
                kritik: (
                  <td key="kritik" className="px-3 py-2.5 text-right text-xs tabular-nums">
                    <div>{p.kritik_stok ?? "—"}<span className="text-muted-foreground"> / </span>{p.min_stok ?? "—"}<span className="text-muted-foreground"> / </span>{p.max_stok ?? "—"}</div>
                  </td>
                ),
                zemanet: (
                  <td key="zemanet" className="px-3 py-2.5 text-right text-xs tabular-nums">{p.zemanet_ay > 0 ? `${p.zemanet_ay} ay` : <span className="text-muted-foreground">—</span>}</td>
                ),
                serial: (
                  <td key="serial" className="px-3 py-2.5 text-xs">
                    <div className="flex gap-1">
                      {p.serial_lazim && <Badge variant="outline" className="text-[9px]">S/N</Badge>}
                      {p.imei_lazim && <Badge variant="outline" className="text-[9px]">IMEI</Badge>}
                      {!p.serial_lazim && !p.imei_lazim && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                ),
                qisa_tesvir: (
                  <td key="qisa_tesvir" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p.qisaca_tesvir ? <span className="line-clamp-2 max-w-xs" title={p.qisaca_tesvir}>{p.qisaca_tesvir}</span> : "—"}
                  </td>
                ),
                yaradildi: (
                  <td key="yaradildi" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p.yaradildi ? new Date(p.yaradildi).toLocaleDateString("az-AZ") : "—"}
                  </td>
                ),
                son_satis: (
                  <td key="son_satis" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p.son_satis_de ? new Date(p.son_satis_de).toLocaleDateString("az-AZ") : <span className="text-muted-foreground/50">heç vaxt</span>}
                  </td>
                ),
                etiketsiz: (
                  <td key="etiketsiz" className="px-3 py-2.5 text-xs">
                    {p.etiketsiz ? <Badge variant="outline" className="text-[10px]">Etiketsiz</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
              };
              return (
                <tr key={p.id} className="group border-b border-border/30 transition hover:bg-secondary/40">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2.5 w-8 group-hover:bg-secondary/40">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`${p.ad} seç`}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-primary"
                    />
                  </td>
                  {cols.order.map((k) => (cols.isVisible(k) ? cells[k] : null))}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        href={`/anbar/mehsullar/${p.id}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="Tam karta keç"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <ProductDialog
                        categories={categories}
                        brands={brands}
                        units={units}
                        initial={{
                          id: p.id,
                          ad: p.ad,
                          kod: p.kod,
                          barkod: p.barkod,
                          kateqoriya_id: p.kateqoriya_id,
                          kateqoriya_ad: p.kateqoriya_ad,
                          marka_id: p.marka_id,
                          marka_ad: p.marka_ad,
                          olcu_id: p.olcu_id,
                          sekil_url: p.sekil_url,
                          aciqlamaq: p.aciqlamaq,
                          alish_qiymeti: p.alish_qiymeti,
                          satis_qiymeti: p.satis_qiymeti,
                          min_satis_qiymeti: p.min_satis_qiymeti,
                          topdan_qiymeti: p.topdan_qiymeti,
                          partnyor_qiymeti: p.partnyor_qiymeti,
                          vip_qiymeti: p.vip_qiymeti,
                          kritik_stok: p.kritik_stok,
                          aktiv: p.aktiv,
                        }}
                        trigger="edit"
                      />
                      <Button size="icon-sm" variant="ghost" title="Sil" disabled={pending} onClick={() => onDelete(p.id, p.ad)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick view modal — opened via Eye button */}
      {quickViewId && (
        <QuickViewDialog
          mehsulId={quickViewId}
          open={!!quickViewId}
          onOpenChange={(v) => { if (!v) setQuickViewId(null); }}
        />
      )}

      <BulkActionsBar
        selectedIds={selectedIds}
        total={items.length}
        onClear={clearSel}
        onSelectAll={toggleAll}
        allSelected={allSelected}
        categories={categories}
        brands={brands}
      />
    </div>
  );
}

function SortableTh({
  label,
  current,
  sortKey,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  current: string;
  sortKey: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  return (
    <th className={cn("px-3 py-2.5", align === "right" && "text-right")}>
      <SortableThInner label={label} current={current} sortKey={sortKey} dir={dir} onClick={onClick} align={align} />
    </th>
  );
}

function SortableThInner({
  label,
  current,
  sortKey,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  current: string;
  sortKey: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = current === sortKey;
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 transition hover:text-foreground",
        active && "text-primary-light",
        align === "right" && "flex-row-reverse"
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  );
}
