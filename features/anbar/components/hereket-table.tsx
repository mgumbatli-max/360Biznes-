"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  History, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ClipboardCheck, Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { formatDate, formatNumber, formatMoney } from "@/lib/utils";

export type HereketRow = {
  id: string;
  tarix: Date | null;
  nov: string;
  mehsul_id: string | null;
  mehsul_ad: string;
  mehsul_kod: string | null;
  mehsul_barkod: string | null;
  mehsul_sekil_url: string | null;
  kateqoriya_ad: string | null;
  kateqoriya_ust_ad: string | null;
  marka_ad: string | null;
  model: string | null;
  rang: string | null;
  istehsalci: string | null;
  olcu_ad: string | null;
  valyuta: string;
  edv_status: string | null;
  zemanet_ay: number;
  mehsul_aciqlamaq: string | null;
  mehsul_qisaca_tesvir: string | null;
  mehsul_servis_sayi: number;
  mehsul_aktiv: boolean;
  anbar_ad: string;
  miqdar: number;
  qiymet: number | null;
  edilen_ad: string | null;
  qeyd: string | null;
  ref_nov: string | null;
  ref_id: string | null;
};

type MovementMeta = { label: string; icon: typeof History; tone: string };
const MOVEMENT: Record<string, MovementMeta> = {
  medaxil: { label: "Mədaxil", icon: ArrowDownToLine, tone: "text-success" },
  mexaric: { label: "Məxaric", icon: ArrowUpFromLine, tone: "text-danger" },
  transfer_giris: { label: "Transfer giriş", icon: ArrowLeftRight, tone: "text-info" },
  transfer_cixis: { label: "Transfer çıxış", icon: ArrowLeftRight, tone: "text-info" },
  inventar: { label: "İnventar", icon: ClipboardCheck, tone: "text-warning" },
  qaytarma_giris: { label: "Qaytarma giriş", icon: ArrowDownToLine, tone: "text-warning" },
  qaytarma_cixis: { label: "Qaytarma çıxış", icon: ArrowUpFromLine, tone: "text-warning" },
};

/** Texniki ref_nov kodlarını istifadəçi dilinə çevir */
const REF_NOV_LABEL: Record<string, string> = {
  manual_adjust: "Manual düzəliş",
  sale: "Satış (POS)",
  sale_legs: "Satış əməliyyatı",
  sales: "Satış",
  satish: "Satış",
  satinalma: "Alış",
  purchase: "Alış",
  alis: "Alış",
  transfer: "Transfer",
  inventar: "Sayım düzəlişi",
  inventarizasiya: "Sayım düzəlişi",
  qaytarma: "Qaytarma",
  return: "Qaytarma",
  bron: "Bron",
  reservation: "Bron",
  konsiqnasiya: "Konsiqnasiya",
  consignment: "Konsiqnasiya",
  import_excel: "Excel idxal",
  excel_import: "Excel idxal",
  api: "API əməliyyatı",
  pos: "POS satışı",
  servis: "Servis",
  legv: "Ləğv",
  yenileme: "Yenilənmə",
};

function refNovLabel(code: string | null): string {
  if (!code) return "—";
  return REF_NOV_LABEL[code] ?? humanize(code);
}

function humanize(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STORAGE_KEY = "anbar-hereketler-cols-v4";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "tarix",       label: "Tarix" },
  { key: "saat_col",    label: "Saat" },
  { key: "nov",         label: "Növ" },
  { key: "mehsul",      label: "Məhsul", required: true },
  { key: "kod_col",     label: "Kod" },
  { key: "barkod_col",  label: "Barkod" },
  { key: "sekil_col",   label: "Şəkil" },
  { key: "alt_kateq",   label: "Alt kataloq" },
  { key: "marka",       label: "Marka" },
  { key: "model_col",   label: "Model" },
  { key: "rang_col",    label: "Rəng" },
  { key: "istehsalci",  label: "İstehsalçı" },
  { key: "olcu_col",    label: "Ölçü vahidi" },
  { key: "anbar",       label: "Anbar" },
  { key: "miqdar",      label: "Miqdar" },
  { key: "qiymet",      label: "Qiymət" },
  { key: "valyuta",     label: "Valyuta" },
  { key: "edv",         label: "ƏDV" },
  { key: "zemanet",     label: "Zəmanət (ay)" },
  { key: "menbe",       label: "Mənbə" },
  { key: "ref_id_col",  label: "Bağlı sənəd №" },
  { key: "istifadeci",  label: "İstifadəçi" },
  { key: "qeyd_col",    label: "Qeyd" },
  { key: "aciqlama",    label: "Açıqlama" },
  { key: "qisa_tesvir", label: "Qısa təsvir" },
  { key: "servis_col",  label: "Servis rəyi" },
  { key: "status_col",  label: "Status" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  tarix: true,
  saat_col: false,
  nov: true,
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
  anbar: true,
  miqdar: true,
  qiymet: true,
  valyuta: false,
  edv: false,
  zemanet: false,
  menbe: true,
  ref_id_col: false,
  istifadeci: true,
  qeyd_col: false,
  aciqlama: false,
  qisa_tesvir: false,
  servis_col: false,
  status_col: false,
};

type SortKey =
  | "tarix" | "mehsul_ad" | "anbar_ad" | "miqdar" | "qiymet" | "nov";

export function HereketTable({ items }: { items: HereketRow[] }) {
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
    if (!sortBy) return items;
    const mult = sortDir === "asc" ? 1 : -1;
    const cmpStr = (a: string | null | undefined, b: string | null | undefined) =>
      (a ?? "").localeCompare(b ?? "", "az") * mult;
    const cmpNum = (a: number, b: number) => (a - b) * mult;
    const cmpDate = (a: Date | null, b: Date | null) =>
      ((a ? a.getTime() : 0) - (b ? b.getTime() : 0)) * mult;
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case "tarix": return cmpDate(a.tarix, b.tarix);
        case "mehsul_ad": return cmpStr(a.mehsul_ad, b.mehsul_ad);
        case "anbar_ad": return cmpStr(a.anbar_ad, b.anbar_ad);
        case "miqdar": return cmpNum(a.miqdar, b.miqdar);
        case "qiymet": return cmpNum(a.qiymet ?? 0, b.qiymet ?? 0);
        case "nov": return cmpStr(a.nov, b.nov);
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="flex items-center justify-end gap-1.5 border-b border-border/60 px-3 py-2">
        {cols.render()}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-sticky-head>
          <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {cols.order.map((key) => {
                if (!cols.isVisible(key)) return null;
                switch (key) {
                  case "tarix":      return <SortableTh key={key} label="Tarix" current={sortBy} sortKey="tarix" dir={sortDir} onClick={setSort} />;
                  case "saat_col":   return <th key={key} className="px-3 py-2.5">Saat</th>;
                  case "nov":        return <SortableTh key={key} label="Növ" current={sortBy} sortKey="nov" dir={sortDir} onClick={setSort} />;
                  case "mehsul":     return <SortableTh key={key} label="Məhsul" current={sortBy} sortKey="mehsul_ad" dir={sortDir} onClick={setSort} />;
                  case "kod_col":    return <th key={key} className="px-3 py-2.5">Kod</th>;
                  case "barkod_col": return <th key={key} className="px-3 py-2.5">Barkod</th>;
                  case "sekil_col":  return <th key={key} className="px-3 py-2.5 w-12">Şəkil</th>;
                  case "alt_kateq":  return <th key={key} className="px-3 py-2.5">Alt kataloq</th>;
                  case "marka":      return <th key={key} className="px-3 py-2.5">Marka</th>;
                  case "model_col":  return <th key={key} className="px-3 py-2.5">Model</th>;
                  case "rang_col":   return <th key={key} className="px-3 py-2.5">Rəng</th>;
                  case "istehsalci": return <th key={key} className="px-3 py-2.5">İstehsalçı</th>;
                  case "olcu_col":   return <th key={key} className="px-3 py-2.5">Ölçü</th>;
                  case "anbar":      return <SortableTh key={key} label="Anbar" current={sortBy} sortKey="anbar_ad" dir={sortDir} onClick={setSort} />;
                  case "miqdar":     return <SortableTh key={key} label="Miqdar" current={sortBy} sortKey="miqdar" dir={sortDir} onClick={setSort} align="right" />;
                  case "qiymet":     return <SortableTh key={key} label="Qiymət" current={sortBy} sortKey="qiymet" dir={sortDir} onClick={setSort} align="right" />;
                  case "valyuta":    return <th key={key} className="px-3 py-2.5">Valyuta</th>;
                  case "edv":        return <th key={key} className="px-3 py-2.5">ƏDV</th>;
                  case "zemanet":    return <th key={key} className="px-3 py-2.5 text-right">Zəmanət</th>;
                  case "menbe":      return <th key={key} className="px-3 py-2.5">Mənbə</th>;
                  case "ref_id_col": return <th key={key} className="px-3 py-2.5">Sənəd №</th>;
                  case "istifadeci": return <th key={key} className="px-3 py-2.5">İstifadəçi</th>;
                  case "qeyd_col":   return <th key={key} className="px-3 py-2.5">Qeyd</th>;
                  case "aciqlama":   return <th key={key} className="px-3 py-2.5">Açıqlama</th>;
                  case "qisa_tesvir":return <th key={key} className="px-3 py-2.5">Qısa təsvir</th>;
                  case "servis_col": return <th key={key} className="px-3 py-2.5 text-right">Servis rəyi</th>;
                  case "status_col": return <th key={key} className="px-3 py-2.5">Status</th>;
                  default: return null;
                }
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={cols.order.length} className="py-12 text-center text-sm text-muted-foreground">Hərəkət yoxdur</td>
              </tr>
            )}
            {sorted.map((m) => {
              const meta = MOVEMENT[m.nov] ?? { label: m.nov, icon: History, tone: "" };
              const Icon = meta.icon;
              const sign = ["medaxil", "transfer_giris", "qaytarma_giris"].includes(m.nov) ? "+" : "−";
              const refLink = m.ref_nov === "satis" ? `/ticaret/satislar/${m.ref_id}`
                : m.ref_nov === "alis" ? `/ticaret/alislar/${m.ref_id}`
                : m.ref_nov === "transfer" ? `/anbar/transfer`
                : null;

              const cells: Record<string, React.ReactNode> = {
                tarix: (
                  <td key="tarix" className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {m.tarix && formatDate(m.tarix, { day: "2-digit", month: "short" })}
                  </td>
                ),
                saat_col: (
                  <td key="saat_col" className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {m.tarix ? new Date(m.tarix).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                nov: (
                  <td key="nov" className="px-3 py-2">
                    <Badge variant="outline" className={`gap-1 text-[10px] ${meta.tone}`}>
                      <Icon className="h-2.5 w-2.5" />
                      {meta.label}
                    </Badge>
                  </td>
                ),
                mehsul: (
                  <td key="mehsul" className="px-3 py-2">
                    {m.mehsul_id ? (
                      <ProductInline
                        id={m.mehsul_id}
                        ad={m.mehsul_ad}
                        kod={cols.isVisible("kod_col") ? null : m.mehsul_kod}
                        barkod={cols.isVisible("barkod_col") ? null : m.mehsul_barkod}
                        showImage={false}
                        size="xs"
                      />
                    ) : (
                      <div className="text-sm font-medium">{m.mehsul_ad}</div>
                    )}
                  </td>
                ),
                kod_col: (
                  <td key="kod_col" className="px-3 py-2 font-mono text-xs text-muted-foreground">{m.mehsul_kod ?? "—"}</td>
                ),
                barkod_col: (
                  <td key="barkod_col" className="px-3 py-2 text-xs text-muted-foreground">
                    {m.mehsul_barkod ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="font-mono">{m.mehsul_barkod}</span>
                        <CopyButton value={m.mehsul_barkod} title="Barkodu kopya et" size="xs" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                sekil_col: (
                  <td key="sekil_col" className="px-3 py-2">
                    {m.mehsul_sekil_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.mehsul_sekil_url} alt={m.mehsul_ad} className="h-8 w-8 rounded-md object-cover border border-border/40" />
                    ) : (
                      <div className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-muted-foreground">
                        <Package className="h-3.5 w-3.5 opacity-50" />
                      </div>
                    )}
                  </td>
                ),
                alt_kateq: (
                  <td key="alt_kateq" className="px-3 py-2 text-xs">
                    {m.kateqoriya_ust_ad ? (
                      <span title={`${m.kateqoriya_ust_ad} / ${m.kateqoriya_ad ?? ""}`}>
                        <span className="text-muted-foreground">{m.kateqoriya_ust_ad}</span>
                        <span className="mx-1 text-muted-foreground/50">/</span>
                        <span>{m.kateqoriya_ad ?? "—"}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{m.kateqoriya_ad ?? "—"}</span>
                    )}
                  </td>
                ),
                marka: (
                  <td key="marka" className="px-3 py-2 text-xs">{m.marka_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                model_col: (
                  <td key="model_col" className="px-3 py-2 text-xs">{m.model ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                rang_col: (
                  <td key="rang_col" className="px-3 py-2 text-xs">{m.rang ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                istehsalci: (
                  <td key="istehsalci" className="px-3 py-2 text-xs">{m.istehsalci ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                olcu_col: (
                  <td key="olcu_col" className="px-3 py-2 text-xs">{m.olcu_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                anbar: (
                  <td key="anbar" className="px-3 py-2 text-xs">{m.anbar_ad}</td>
                ),
                miqdar: (
                  <td key="miqdar" className={`px-3 py-2 text-right tabular-nums font-semibold ${meta.tone}`}>
                    {sign} {formatNumber(m.miqdar, 0)}
                  </td>
                ),
                qiymet: (
                  <td key="qiymet" className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {m.qiymet ? formatMoney(m.qiymet) : "—"}
                  </td>
                ),
                valyuta: (
                  <td key="valyuta" className="px-3 py-2 text-xs">{m.valyuta}</td>
                ),
                edv: (
                  <td key="edv" className="px-3 py-2 text-xs">
                    {m.edv_status === "edv_var" && <Badge variant="outline" className="text-[10px]">ƏDV 18%</Badge>}
                    {m.edv_status === "edv_yox" && <Badge variant="outline" className="text-[10px] text-muted-foreground">ƏDV yox</Badge>}
                    {m.edv_status === "edv_azad" && <Badge variant="outline" className="text-[10px] text-info">Azad</Badge>}
                    {!m.edv_status && <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                zemanet: (
                  <td key="zemanet" className="px-3 py-2 text-right text-xs">
                    {m.zemanet_ay > 0 ? `${m.zemanet_ay} ay` : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                menbe: (
                  <td key="menbe" className="px-3 py-2 text-xs">
                    {refLink ? (
                      <Link
                        href={refLink}
                        className="text-primary hover:underline"
                        title={m.ref_nov ?? undefined}
                      >
                        {refNovLabel(m.ref_nov)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground" title={m.ref_nov ?? undefined}>
                        {refNovLabel(m.ref_nov)}
                      </span>
                    )}
                  </td>
                ),
                ref_id_col: (
                  <td key="ref_id_col" className="px-3 py-2 font-mono text-[10.5px] text-muted-foreground">
                    {m.ref_id ? (
                      <span className="inline-flex items-center gap-0.5" title={m.ref_id}>
                        <span>{m.ref_id.slice(0, 8)}</span>
                        <CopyButton value={m.ref_id} title="Sənəd ID kopya et" size="xs" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                istifadeci: (
                  <td key="istifadeci" className="px-3 py-2 text-xs text-muted-foreground">{m.edilen_ad ?? "—"}</td>
                ),
                qeyd_col: (
                  <td key="qeyd_col" className="px-3 py-2 text-xs text-muted-foreground">
                    {m.qeyd ? <span className="line-clamp-2 max-w-xs" title={m.qeyd}>{m.qeyd}</span> : "—"}
                  </td>
                ),
                aciqlama: (
                  <td key="aciqlama" className="px-3 py-2 text-xs text-muted-foreground">
                    {m.mehsul_aciqlamaq ? (
                      <span className="line-clamp-2 max-w-xs" title={m.mehsul_aciqlamaq}>{m.mehsul_aciqlamaq}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                qisa_tesvir: (
                  <td key="qisa_tesvir" className="px-3 py-2 text-xs text-muted-foreground">
                    {m.mehsul_qisaca_tesvir ? (
                      <span className="line-clamp-2 max-w-xs" title={m.mehsul_qisaca_tesvir}>{m.mehsul_qisaca_tesvir}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
                servis_col: (
                  <td key="servis_col" className="px-3 py-2 text-right">
                    {m.mehsul_servis_sayi > 0 ? (
                      <Link href={`/servis?q=${encodeURIComponent(m.mehsul_ad)}`} className="inline-flex items-center gap-1 text-xs hover:text-primary">
                        <span className="font-semibold tabular-nums">{m.mehsul_servis_sayi}</span>
                        <span className="text-[10px] text-muted-foreground">qeyd</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                status_col: (
                  <td key="status_col" className="px-3 py-2">
                    {m.mehsul_id ? (
                      m.mehsul_aktiv ? (
                        <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Aktiv</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Passiv</Badge>
                      )
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                ),
              };

              return (
                <tr key={m.id} className="border-b border-border/30 hover:bg-secondary/40">
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
