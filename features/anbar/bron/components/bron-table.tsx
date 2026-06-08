"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Bookmark, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { CancelBronButton } from "./bron-row-actions";
import { formatDate, formatNumber, formatMoney } from "@/lib/utils";
import type { BronRow } from "../queries";

type Props = {
  rows: BronRow[];
};

const STORAGE_KEY = "anbar-bron-cols-v4";

const STATUS_INFO: Record<string, { cls: string; dotCls: string; label?: string }> = {
  aktiv: {
    cls: "bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.06] text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300",
    dotCls: "bg-emerald-500 animate-pulse",
  },
  vaxti_bitdi: {
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500",
  },
  satish_oldu: {
    cls: "bg-gradient-to-b from-sky-500/15 to-sky-500/[0.06] text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300",
    dotCls: "bg-sky-500",
  },
  legv: {
    cls: "bg-gradient-to-b from-rose-500/15 to-rose-500/[0.06] text-rose-700 ring-1 ring-inset ring-rose-500/20 line-through decoration-rose-500/40 dark:text-rose-300",
    dotCls: "bg-rose-500",
  },
};
const STATUS_CLS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_INFO).map(([k, v]) => [k, v.cls]),
);

const COLUMN_DEFS: ColumnDef[] = [
  { key: "tarix",         label: "Başlama tarixi" },
  { key: "yaradildi_col", label: "Yaradılma tarixi" },
  { key: "bitir",         label: "Bitir" },
  { key: "mehsul",        label: "Məhsul", required: true },
  { key: "kod_col",       label: "Kod" },
  { key: "barkod_col",    label: "Barkod" },
  { key: "sekil_col",     label: "Şəkil" },
  { key: "alt_kateq",     label: "Alt kataloq" },
  { key: "marka",         label: "Marka" },
  { key: "model_col",     label: "Model" },
  { key: "rang_col",      label: "Rəng" },
  { key: "istehsalci",    label: "İstehsalçı" },
  { key: "olcu_col",      label: "Ölçü vahidi" },
  { key: "musteri",       label: "Müştəri" },
  { key: "anbar",         label: "Anbar" },
  { key: "sayi",          label: "Sayı" },
  { key: "qiymet_col",    label: "Bron qiyməti" },
  { key: "satis_qiymet",  label: "Satış qiyməti" },
  { key: "valyuta",       label: "Valyuta" },
  { key: "edv",           label: "ƏDV" },
  { key: "zemanet",       label: "Zəmanət (ay)" },
  { key: "qeyd_col",      label: "Qeyd" },
  { key: "aciqlama",      label: "Məhsul açıqlaması" },
  { key: "qisa_tesvir",   label: "Qısa təsvir" },
  { key: "servis_col",    label: "Servis rəyi" },
  { key: "aktiv_col",     label: "Məhsul aktivliyi" },
  { key: "status",        label: "Status" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  tarix: true,
  yaradildi_col: false,
  bitir: true,
  mehsul: true,
  kod_col: false,
  barkod_col: false,
  sekil_col: false,
  alt_kateq: false,
  marka: false,
  model_col: false,
  rang_col: false,
  istehsalci: false,
  olcu_col: false,
  musteri: true,
  anbar: true,
  sayi: true,
  qiymet_col: false,
  satis_qiymet: false,
  valyuta: false,
  edv: false,
  zemanet: false,
  qeyd_col: false,
  aciqlama: false,
  qisa_tesvir: false,
  servis_col: false,
  aktiv_col: false,
  status: true,
};

type SortKey =
  | "tarix" | "yaradildi" | "mehsul_ad" | "musteri_ad"
  | "sayi" | "qiymet" | "bitme_tarixi" | "status";

export function BronTable({ rows }: Props) {
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ visible: DEFAULT_VISIBLE, order: DEFAULT_ORDER }),
        );
      }
    } catch {}
  }, []);

  const cols = useColumnToggle(STORAGE_KEY, COLUMN_DEFS, DEFAULT_ORDER);
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const sortBy = (sp.get("sort") ?? "") as SortKey | "";
  const sortDir = (sp.get("dir") as SortDir) ?? "asc";

  function setSort(key: string) {
    const newDir: SortDir = sortBy === key && sortDir === "asc" ? "desc" : "asc";
    const params = new URLSearchParams(sp.toString());
    params.set("sort", key);
    params.set("dir", newDir);
    router.push(`${pathname}?${params.toString()}`);
  }

  const sorted = useMemo(() => {
    if (!sortBy) return rows;
    const mult = sortDir === "asc" ? 1 : -1;
    const cmpStr = (a: string | null | undefined, b: string | null | undefined) =>
      (a ?? "").localeCompare(b ?? "", "az") * mult;
    const cmpNum = (a: number, b: number) => (a - b) * mult;
    const cmpDate = (a: Date | null, b: Date | null) =>
      ((a ? a.getTime() : 0) - (b ? b.getTime() : 0)) * mult;
    return [...rows].sort((a, b) => {
      switch (sortBy) {
        case "tarix": return cmpDate(a.baslama_tarixi, b.baslama_tarixi);
        case "yaradildi": return cmpDate(a.yaradildi, b.yaradildi);
        case "mehsul_ad": return cmpStr(a.mehsul_ad, b.mehsul_ad);
        case "musteri_ad": return cmpStr(a.kontragent_ad ?? a.musteri_ad, b.kontragent_ad ?? b.musteri_ad);
        case "sayi": return cmpNum(a.sayi, b.sayi);
        case "qiymet": return cmpNum(a.qiymet ?? 0, b.qiymet ?? 0);
        case "bitme_tarixi": return cmpDate(a.bitme_tarixi, b.bitme_tarixi);
        case "status": return cmpStr(a.status, b.status);
        default: return 0;
      }
    });
  }, [rows, sortBy, sortDir]);

  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="flex items-center justify-end gap-1.5 border-b border-border/60 px-3 py-2">
        {cols.render()}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-sticky-head>
          <thead className="border-b border-border/40 bg-secondary/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {cols.order.map((key) => {
                if (!cols.isVisible(key)) return null;
                switch (key) {
                  case "tarix":         return <SortableTh key={key} label="Başlama" current={sortBy} sortKey="tarix" dir={sortDir} onClick={setSort} className="py-2" />;
                  case "yaradildi_col": return <SortableTh key={key} label="Yaradıldı" current={sortBy} sortKey="yaradildi" dir={sortDir} onClick={setSort} className="py-2" />;
                  case "bitir":         return <SortableTh key={key} label="Bitir" current={sortBy} sortKey="bitme_tarixi" dir={sortDir} onClick={setSort} className="py-2" />;
                  case "mehsul":        return <SortableTh key={key} label="Məhsul" current={sortBy} sortKey="mehsul_ad" dir={sortDir} onClick={setSort} className="py-2" />;
                  case "kod_col":       return <th key={key} className="px-3 py-2">Kod</th>;
                  case "barkod_col":    return <th key={key} className="px-3 py-2">Barkod</th>;
                  case "sekil_col":     return <th key={key} className="px-3 py-2 w-12">Şəkil</th>;
                  case "alt_kateq":     return <th key={key} className="px-3 py-2">Alt kataloq</th>;
                  case "marka":         return <th key={key} className="px-3 py-2">Marka</th>;
                  case "model_col":     return <th key={key} className="px-3 py-2">Model</th>;
                  case "rang_col":      return <th key={key} className="px-3 py-2">Rəng</th>;
                  case "istehsalci":    return <th key={key} className="px-3 py-2">İstehsalçı</th>;
                  case "olcu_col":      return <th key={key} className="px-3 py-2">Ölçü</th>;
                  case "musteri":       return <SortableTh key={key} label="Müştəri" current={sortBy} sortKey="musteri_ad" dir={sortDir} onClick={setSort} className="py-2" />;
                  case "anbar":         return <th key={key} className="px-3 py-2">Anbar</th>;
                  case "sayi":          return <SortableTh key={key} label="Say" current={sortBy} sortKey="sayi" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "qiymet_col":    return <SortableTh key={key} label="Bron qiyməti" current={sortBy} sortKey="qiymet" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "satis_qiymet":  return <th key={key} className="px-3 py-2 text-right">Satış</th>;
                  case "valyuta":       return <th key={key} className="px-3 py-2">Valyuta</th>;
                  case "edv":           return <th key={key} className="px-3 py-2">ƏDV</th>;
                  case "zemanet":       return <th key={key} className="px-3 py-2 text-right">Zəmanət</th>;
                  case "qeyd_col":      return <th key={key} className="px-3 py-2">Qeyd</th>;
                  case "aciqlama":      return <th key={key} className="px-3 py-2">Açıqlama</th>;
                  case "qisa_tesvir":   return <th key={key} className="px-3 py-2">Qısa təsvir</th>;
                  case "servis_col":    return <th key={key} className="px-3 py-2 text-right">Servis rəyi</th>;
                  case "aktiv_col":     return <th key={key} className="px-3 py-2">Aktiv</th>;
                  case "status":        return <SortableTh key={key} label="Status" current={sortBy} sortKey="status" dir={sortDir} onClick={setSort} className="py-2" />;
                  default: return null;
                }
              })}
              <th className="px-3 py-2 text-right">Əməl</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={cols.order.length + 1} className="py-12 text-center text-sm text-muted-foreground">
                  <Bookmark className="mx-auto mb-2 h-6 w-6 opacity-30" />
                  Bron yoxdur
                </td>
              </tr>
            )}
            {sorted.map((b) => {
              const cells: Record<string, React.ReactNode> = {
                tarix: (
                  <td key="tarix" className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(b.baslama_tarixi)}
                  </td>
                ),
                yaradildi_col: (
                  <td key="yaradildi_col" className="px-3 py-2 text-xs text-muted-foreground">
                    {b.yaradildi ? formatDate(b.yaradildi) : "—"}
                  </td>
                ),
                bitir: (
                  <td key="bitir" className="px-3 py-2 text-xs">
                    {b.bitme_tarixi ? formatDate(b.bitme_tarixi) : "—"}
                  </td>
                ),
                mehsul: (
                  <td key="mehsul" className="px-3 py-2">
                    <ProductInline
                      id={b.mehsul_id}
                      ad={b.mehsul_ad}
                      kod={cols.isVisible("kod_col") ? null : b.mehsul_kod}
                      barkod={cols.isVisible("barkod_col") ? null : b.barkod}
                      showImage={false}
                      size="xs"
                    />
                  </td>
                ),
                kod_col: (
                  <td key="kod_col" className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {b.mehsul_kod ?? "—"}
                  </td>
                ),
                barkod_col: (
                  <td key="barkod_col" className="px-3 py-2 text-xs text-muted-foreground">
                    {b.mehsul_barkod ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="font-mono">{b.mehsul_barkod}</span>
                        <CopyButton value={b.mehsul_barkod} title="Barkodu kopya et" size="xs" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                sekil_col: (
                  <td key="sekil_col" className="px-3 py-2">
                    {b.mehsul_sekil_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img loading="lazy" decoding="async" src={b.mehsul_sekil_url} alt={b.mehsul_ad} className="h-8 w-8 rounded-md object-cover border border-border/40" />
                    ) : (
                      <div className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-muted-foreground">
                        <Package className="h-3.5 w-3.5 opacity-50" />
                      </div>
                    )}
                  </td>
                ),
                alt_kateq: (
                  <td key="alt_kateq" className="px-3 py-2 text-xs">
                    {b.kateqoriya_ust_ad ? (
                      <span title={`${b.kateqoriya_ust_ad} / ${b.kateqoriya_ad ?? ""}`}>
                        <span className="text-muted-foreground">{b.kateqoriya_ust_ad}</span>
                        <span className="mx-1 text-muted-foreground/50">/</span>
                        <span>{b.kateqoriya_ad ?? "—"}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{b.kateqoriya_ad ?? "—"}</span>
                    )}
                  </td>
                ),
                marka: (
                  <td key="marka" className="px-3 py-2 text-xs">{b.marka_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                model_col: (
                  <td key="model_col" className="px-3 py-2 text-xs">{b.model ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                rang_col: (
                  <td key="rang_col" className="px-3 py-2 text-xs">{b.rang ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                istehsalci: (
                  <td key="istehsalci" className="px-3 py-2 text-xs">{b.istehsalci ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                olcu_col: (
                  <td key="olcu_col" className="px-3 py-2 text-xs">{b.olcu_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                musteri: (
                  <td key="musteri" className="px-3 py-2">
                    <div>{b.kontragent_ad || b.musteri_ad || "—"}</div>
                    {b.musteri_telefon && <div className="text-[10.5px] text-muted-foreground">{b.musteri_telefon}</div>}
                  </td>
                ),
                anbar: (
                  <td key="anbar" className="px-3 py-2 text-xs">{b.anbar_ad ?? "—"}</td>
                ),
                sayi: (
                  <td key="sayi" className="px-3 py-2 text-right tabular-nums font-semibold">
                    {formatNumber(b.sayi, 0)}
                  </td>
                ),
                qiymet_col: (
                  <td key="qiymet_col" className="px-3 py-2 text-right tabular-nums text-xs">
                    {b.qiymet != null ? formatMoney(b.qiymet) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                satis_qiymet: (
                  <td key="satis_qiymet" className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {b.mehsul_satis_qiymeti > 0 ? formatMoney(b.mehsul_satis_qiymeti) : "—"}
                  </td>
                ),
                valyuta: (
                  <td key="valyuta" className="px-3 py-2 text-xs">{b.valyuta}</td>
                ),
                edv: (
                  <td key="edv" className="px-3 py-2 text-xs">
                    {b.edv_status === "edv_var" && <Badge variant="outline" className="text-[10px]">ƏDV 18%</Badge>}
                    {b.edv_status === "edv_yox" && <Badge variant="outline" className="text-[10px] text-muted-foreground">ƏDV yox</Badge>}
                    {b.edv_status === "edv_azad" && <Badge variant="outline" className="text-[10px] text-info">Azad</Badge>}
                    {!b.edv_status && <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                zemanet: (
                  <td key="zemanet" className="px-3 py-2 text-right text-xs">
                    {b.zemanet_ay > 0 ? `${b.zemanet_ay} ay` : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                qeyd_col: (
                  <td key="qeyd_col" className="px-3 py-2 text-xs text-muted-foreground">
                    {b.qeyd ? <span className="line-clamp-2 max-w-xs" title={b.qeyd}>{b.qeyd}</span> : "—"}
                  </td>
                ),
                aciqlama: (
                  <td key="aciqlama" className="px-3 py-2 text-xs text-muted-foreground">
                    {b.mehsul_aciqlamaq ? (
                      <span className="line-clamp-2 max-w-xs" title={b.mehsul_aciqlamaq}>{b.mehsul_aciqlamaq}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                qisa_tesvir: (
                  <td key="qisa_tesvir" className="px-3 py-2 text-xs text-muted-foreground">
                    {b.mehsul_qisaca_tesvir ? (
                      <span className="line-clamp-2 max-w-xs" title={b.mehsul_qisaca_tesvir}>{b.mehsul_qisaca_tesvir}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                servis_col: (
                  <td key="servis_col" className="px-3 py-2 text-right">
                    {b.mehsul_servis_sayi > 0 ? (
                      <Link href={`/servis?q=${encodeURIComponent(b.mehsul_ad)}`} className="inline-flex items-center gap-1 text-xs hover:text-primary">
                        <span className="font-semibold tabular-nums">{b.mehsul_servis_sayi}</span>
                        <span className="text-[10px] text-muted-foreground">qeyd</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                aktiv_col: (
                  <td key="aktiv_col" className="px-3 py-2">
                    {b.mehsul_aktiv ? (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Aktiv</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Passiv</Badge>
                    )}
                  </td>
                ),
                status: (() => {
                  const info = STATUS_INFO[b.status];
                  return (
                    <td key="status" className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-none shadow-sm shadow-black/[0.02] dark:shadow-black/20 ${info?.cls ?? "bg-muted text-muted-foreground"}`}>
                        {info && <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${info.dotCls}`} />}
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                  );
                })(),
              };
              return (
                <tr key={b.id} className="border-b border-border/20 hover:bg-secondary/30">
                  {cols.order.map((k) => (cols.isVisible(k) ? cells[k] : null))}
                  <td className="px-3 py-2 text-right">
                    {b.status === "aktiv" && <CancelBronButton id={b.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
