"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Handshake, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { formatDate, formatNumber, formatMoney } from "@/lib/utils";
import type { KonsRow } from "../queries";

type Props = {
  rows: KonsRow[];
};

const STORAGE_KEY = "anbar-konsiqnasiya-cols-v4";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "tarix",         label: "Verilmə tarixi" },
  { key: "qaytarilma",    label: "Qaytarılma tarixi" },
  { key: "yaradildi_col", label: "Yaradılma tarixi" },
  { key: "istiqamet",     label: "İstiqamət" },
  { key: "qarsi_teref",   label: "Qarşı tərəf" },
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
  { key: "sayi",          label: "Sayı" },
  { key: "satilan",       label: "Satılan" },
  { key: "qaliq",         label: "Qalıq" },
  { key: "qiymet_col",    label: "Qiymət" },
  { key: "satis_qiymet",  label: "Satış qiyməti" },
  { key: "valyuta",       label: "Valyuta" },
  { key: "edv",           label: "ƏDV" },
  { key: "zemanet",       label: "Zəmanət (ay)" },
  { key: "qeyd_col",      label: "Qeyd" },
  { key: "aciqlama",      label: "Açıqlama" },
  { key: "qisa_tesvir",   label: "Qısa təsvir" },
  { key: "servis_col",    label: "Servis rəyi" },
  { key: "aktiv_col",     label: "Aktiv" },
  { key: "status",        label: "Status" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  tarix: true,
  qaytarilma: false,
  yaradildi_col: false,
  istiqamet: true,
  qarsi_teref: true,
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
  sayi: true,
  satilan: true,
  qaliq: true,
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
  | "verilme_tarixi" | "mehsul_ad" | "kontragent_ad"
  | "sayi" | "satilan_say" | "qaliq_say" | "qiymet";

export function KonsTable({ rows }: Props) {
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
        case "verilme_tarixi": return cmpDate(a.verilme_tarixi, b.verilme_tarixi);
        case "mehsul_ad": return cmpStr(a.mehsul_ad, b.mehsul_ad);
        case "kontragent_ad": return cmpStr(a.kontragent_ad, b.kontragent_ad);
        case "sayi": return cmpNum(a.sayi, b.sayi);
        case "satilan_say": return cmpNum(a.satilan_say, b.satilan_say);
        case "qaliq_say": return cmpNum(a.qaliq_say, b.qaliq_say);
        case "qiymet": return cmpNum(a.qiymet ?? 0, b.qiymet ?? 0);
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
                  case "tarix":         return <SortableTh key={key} label="Verilmə" current={sortBy} sortKey="verilme_tarixi" dir={sortDir} onClick={setSort} className="py-2" />;
                  case "qaytarilma":    return <th key={key} className="px-3 py-2">Qaytarılma</th>;
                  case "yaradildi_col": return <th key={key} className="px-3 py-2">Yaradıldı</th>;
                  case "istiqamet":     return <th key={key} className="px-3 py-2">İstiqamət</th>;
                  case "qarsi_teref":   return <SortableTh key={key} label="Qarşı tərəf" current={sortBy} sortKey="kontragent_ad" dir={sortDir} onClick={setSort} className="py-2" />;
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
                  case "sayi":          return <SortableTh key={key} label="Say" current={sortBy} sortKey="sayi" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "satilan":       return <SortableTh key={key} label="Satılan" current={sortBy} sortKey="satilan_say" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "qaliq":         return <SortableTh key={key} label="Qalıq" current={sortBy} sortKey="qaliq_say" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "qiymet_col":    return <SortableTh key={key} label="Qiymət" current={sortBy} sortKey="qiymet" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "satis_qiymet":  return <th key={key} className="px-3 py-2 text-right">Satış</th>;
                  case "valyuta":       return <th key={key} className="px-3 py-2">Valyuta</th>;
                  case "edv":           return <th key={key} className="px-3 py-2">ƏDV</th>;
                  case "zemanet":       return <th key={key} className="px-3 py-2 text-right">Zəmanət</th>;
                  case "qeyd_col":      return <th key={key} className="px-3 py-2">Qeyd</th>;
                  case "aciqlama":      return <th key={key} className="px-3 py-2">Açıqlama</th>;
                  case "qisa_tesvir":   return <th key={key} className="px-3 py-2">Qısa təsvir</th>;
                  case "servis_col":    return <th key={key} className="px-3 py-2 text-right">Servis rəyi</th>;
                  case "aktiv_col":     return <th key={key} className="px-3 py-2">Aktiv</th>;
                  case "status":        return <th key={key} className="px-3 py-2">Status</th>;
                  default: return null;
                }
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={cols.order.length} className="py-12 text-center text-sm text-muted-foreground">
                  <Handshake className="mx-auto mb-2 h-6 w-6 opacity-30" />
                  Konsiqnasiya yoxdur
                </td>
              </tr>
            )}
            {sorted.map((r) => {
              const cells: Record<string, React.ReactNode> = {
                tarix: (
                  <td key="tarix" className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(r.verilme_tarixi)}
                  </td>
                ),
                qaytarilma: (
                  <td key="qaytarilma" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.qaytarilma_tarixi ? formatDate(r.qaytarilma_tarixi) : "—"}
                  </td>
                ),
                yaradildi_col: (
                  <td key="yaradildi_col" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.yaradildi ? formatDate(r.yaradildi) : "—"}
                  </td>
                ),
                istiqamet: (
                  <td key="istiqamet" className="px-3 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                      r.istiqamet === "verilen" ? "bg-warning/15 text-warning" : "bg-info/15 text-info"
                    }`}>
                      {r.istiqamet === "verilen" ? "↗ Verilən" : "↙ Alınan"}
                    </span>
                  </td>
                ),
                qarsi_teref: (
                  <td key="qarsi_teref" className="px-3 py-2 font-medium">{r.kontragent_ad}</td>
                ),
                mehsul: (
                  <td key="mehsul" className="px-3 py-2">
                    <ProductInline
                      id={r.mehsul_id}
                      ad={r.mehsul_ad}
                      kod={cols.isVisible("kod_col") ? null : r.mehsul_kod}
                      barkod={cols.isVisible("barkod_col") ? null : r.mehsul_barkod}
                      showImage={false}
                      size="xs"
                    />
                  </td>
                ),
                kod_col: (
                  <td key="kod_col" className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.mehsul_kod ?? "—"}</td>
                ),
                barkod_col: (
                  <td key="barkod_col" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.mehsul_barkod ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="font-mono">{r.mehsul_barkod}</span>
                        <CopyButton value={r.mehsul_barkod} title="Barkodu kopya et" size="xs" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                sekil_col: (
                  <td key="sekil_col" className="px-3 py-2">
                    {r.mehsul_sekil_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.mehsul_sekil_url} alt={r.mehsul_ad} className="h-8 w-8 rounded-md object-cover border border-border/40" />
                    ) : (
                      <div className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-muted-foreground">
                        <Package className="h-3.5 w-3.5 opacity-50" />
                      </div>
                    )}
                  </td>
                ),
                alt_kateq: (
                  <td key="alt_kateq" className="px-3 py-2 text-xs">
                    {r.kateqoriya_ust_ad ? (
                      <span title={`${r.kateqoriya_ust_ad} / ${r.kateqoriya_ad ?? ""}`}>
                        <span className="text-muted-foreground">{r.kateqoriya_ust_ad}</span>
                        <span className="mx-1 text-muted-foreground/50">/</span>
                        <span>{r.kateqoriya_ad ?? "—"}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{r.kateqoriya_ad ?? "—"}</span>
                    )}
                  </td>
                ),
                marka: (
                  <td key="marka" className="px-3 py-2 text-xs">{r.marka_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                model_col: (
                  <td key="model_col" className="px-3 py-2 text-xs">{r.model ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                rang_col: (
                  <td key="rang_col" className="px-3 py-2 text-xs">{r.rang ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                istehsalci: (
                  <td key="istehsalci" className="px-3 py-2 text-xs">{r.istehsalci ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                olcu_col: (
                  <td key="olcu_col" className="px-3 py-2 text-xs">{r.olcu_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                sayi: (
                  <td key="sayi" className="px-3 py-2 text-right tabular-nums">{formatNumber(r.sayi, 0)}</td>
                ),
                satilan: (
                  <td key="satilan" className="px-3 py-2 text-right tabular-nums text-success">{formatNumber(r.satilan_say, 0)}</td>
                ),
                qaliq: (
                  <td key="qaliq" className="px-3 py-2 text-right tabular-nums font-semibold">{formatNumber(r.qaliq_say, 0)}</td>
                ),
                qiymet_col: (
                  <td key="qiymet_col" className="px-3 py-2 text-right tabular-nums text-xs">
                    {r.qiymet != null ? formatMoney(r.qiymet) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                satis_qiymet: (
                  <td key="satis_qiymet" className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {r.mehsul_satis_qiymeti > 0 ? formatMoney(r.mehsul_satis_qiymeti) : "—"}
                  </td>
                ),
                valyuta: (
                  <td key="valyuta" className="px-3 py-2 text-xs">{r.valyuta}</td>
                ),
                edv: (
                  <td key="edv" className="px-3 py-2 text-xs">
                    {r.edv_status === "edv_var" && <Badge variant="outline" className="text-[10px]">ƏDV 18%</Badge>}
                    {r.edv_status === "edv_yox" && <Badge variant="outline" className="text-[10px] text-muted-foreground">ƏDV yox</Badge>}
                    {r.edv_status === "edv_azad" && <Badge variant="outline" className="text-[10px] text-info">Azad</Badge>}
                    {!r.edv_status && <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                zemanet: (
                  <td key="zemanet" className="px-3 py-2 text-right text-xs">
                    {r.zemanet_ay > 0 ? `${r.zemanet_ay} ay` : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                qeyd_col: (
                  <td key="qeyd_col" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.qeyd ? <span className="line-clamp-2 max-w-xs" title={r.qeyd}>{r.qeyd}</span> : "—"}
                  </td>
                ),
                aciqlama: (
                  <td key="aciqlama" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.mehsul_aciqlamaq ? (
                      <span className="line-clamp-2 max-w-xs" title={r.mehsul_aciqlamaq}>{r.mehsul_aciqlamaq}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                qisa_tesvir: (
                  <td key="qisa_tesvir" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.mehsul_qisaca_tesvir ? (
                      <span className="line-clamp-2 max-w-xs" title={r.mehsul_qisaca_tesvir}>{r.mehsul_qisaca_tesvir}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                servis_col: (
                  <td key="servis_col" className="px-3 py-2 text-right">
                    {r.mehsul_servis_sayi > 0 ? (
                      <Link href={`/servis?q=${encodeURIComponent(r.mehsul_ad)}`} className="inline-flex items-center gap-1 text-xs hover:text-primary">
                        <span className="font-semibold tabular-nums">{r.mehsul_servis_sayi}</span>
                        <span className="text-[10px] text-muted-foreground">qeyd</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                aktiv_col: (
                  <td key="aktiv_col" className="px-3 py-2">
                    {r.mehsul_aktiv ? (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Aktiv</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Passiv</Badge>
                    )}
                  </td>
                ),
                status: (
                  <td key="status" className="px-3 py-2">
                    <span className="inline-block rounded bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase">{r.status}</span>
                  </td>
                ),
              };
              return (
                <tr key={r.id} className="border-b border-border/20 hover:bg-secondary/30">
                  {cols.order.map((k) => (cols.isVisible(k) ? cells[k] : null))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
