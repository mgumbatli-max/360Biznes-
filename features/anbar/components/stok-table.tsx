"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowDown, ArrowUp, History, Package, ArrowLeftRight, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { StockAdjustDialog } from "@/features/anbar/components/stock-adjust-dialog";
import { TransferDialog } from "@/features/anbar/components/transfer-dialog";
import { formatMoney, formatNumber } from "@/lib/utils";
import type { StokRow } from "@/features/anbar/stok-queries";

type Anbar = { id: number; ad: string };

type Props = {
  rows: StokRow[];
  anbarlar: Anbar[];
  exportHref: string;
};

const STORAGE_KEY = "anbar-stok-cols-v4";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "sekil_col",   label: "Şəkil" },
  { key: "mehsul",      label: "Məhsul", required: true },
  { key: "kod",         label: "Kod" },
  { key: "barkod_col",  label: "Barkod" },
  { key: "alt_kateq",   label: "Alt kataloq" },
  { key: "marka",       label: "Marka" },
  { key: "model",       label: "Model" },
  { key: "rang",        label: "Rəng" },
  { key: "istehsalci",  label: "İstehsalçı" },
  { key: "olcu",        label: "Ölçü vahidi" },
  { key: "anbar",       label: "Anbar" },
  { key: "qaliq",       label: "Qalıq" },
  { key: "rezerv",      label: "Rezerv" },
  { key: "movcud",      label: "Mövcud" },
  { key: "min",         label: "Min." },
  { key: "kritik",      label: "Kritik" },
  { key: "max",         label: "Maks." },
  { key: "alish",       label: "Maya (alış)" },
  { key: "satis",       label: "Satış qiyməti" },
  { key: "qiymet",      label: "Son qiymət" },
  { key: "deyer",       label: "Cəm dəyər" },
  { key: "valyuta",     label: "Valyuta" },
  { key: "edv",         label: "ƏDV statusu" },
  { key: "zemanet",     label: "Zəmanət (ay)" },
  { key: "etiketsiz",   label: "Etiketsiz" },
  { key: "yaradildi",   label: "Yaradıldı" },
  { key: "son_hereket", label: "Son hərəkət" },
  { key: "son_ay_say",  label: "Son ay hərəkət" },
  { key: "qisa_tesvir", label: "Qısaca təsvir" },
  { key: "aciqlama",    label: "Məhsul haqqında" },
  { key: "status_col",  label: "Status" },
  { key: "servis_col",  label: "Servis rəyi" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

// Existing/core columns ON, new toggle-columns OFF by default.
const DEFAULT_VISIBLE: Record<string, boolean> = {
  sekil_col: false,
  mehsul: true,
  kod: true,
  barkod_col: false,
  alt_kateq: false,
  marka: false,
  model: false,
  rang: false,
  istehsalci: false,
  olcu: false,
  anbar: true,
  qaliq: true,
  rezerv: true,
  movcud: true,
  min: true,
  kritik: false,
  max: false,
  alish: false,
  satis: false,
  qiymet: true,
  deyer: true,
  valyuta: false,
  edv: false,
  zemanet: false,
  etiketsiz: false,
  yaradildi: false,
  son_hereket: false,
  son_ay_say: false,
  qisa_tesvir: false,
  aciqlama: false,
  status_col: false,
  servis_col: false,
};

const ALIGN_RIGHT = new Set([
  "qaliq", "rezerv", "movcud", "min", "kritik", "max",
  "alish", "satis", "qiymet", "deyer", "zemanet", "son_ay_say", "servis_col",
]);

type SortKey =
  | "ad" | "kod" | "anbar" | "qaliq" | "rezerv" | "movcud"
  | "min" | "alish" | "satis" | "qiymet" | "deyer"
  | "son_hereket" | "son_ay_say";

export function StokTable({ rows, anbarlar, exportHref }: Props) {
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
        case "ad": return cmpStr(a.ad, b.ad);
        case "kod": return cmpStr(a.kod, b.kod);
        case "anbar": return cmpStr(a.anbar_ad, b.anbar_ad);
        case "qaliq": return cmpNum(a.miqdar, b.miqdar);
        case "rezerv": return cmpNum(a.rezerv, b.rezerv);
        case "movcud": return cmpNum(a.movcud, b.movcud);
        case "min": return cmpNum(a.min_stok ?? 0, b.min_stok ?? 0);
        case "alish": return cmpNum(a.alish_qiymeti, b.alish_qiymeti);
        case "satis": return cmpNum(a.satis_qiymeti, b.satis_qiymeti);
        case "qiymet": return cmpNum(a.son_qiymet, b.son_qiymet);
        case "deyer": return cmpNum(a.cem_deyer, b.cem_deyer);
        case "son_hereket": return cmpDate(a.son_hereket_de, b.son_hereket_de);
        case "son_ay_say": return cmpNum(a.son_ay_hereket_say, b.son_ay_hereket_say);
        default: return 0;
      }
    });
  }, [rows, sortBy, sortDir]);

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-end gap-1.5 border-b border-border/60 px-3 py-2">
        {cols.render()}
        <a
          href={exportHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          target="_blank"
          rel="noopener"
        >
          Excel ixrac
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-sticky-head>
          <thead className="border-b border-border/40 bg-secondary/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {cols.order.map((key) => {
                if (!cols.isVisible(key)) return null;
                const align = ALIGN_RIGHT.has(key) ? "text-right" : "";
                switch (key) {
                  case "sekil_col":   return <th key={key} className="px-3 py-2 w-12">Şəkil</th>;
                  case "mehsul":      return <SortableTh key={key} label="Məhsul" current={sortBy} sortKey="ad" dir={sortDir} onClick={setSort} className="py-2" />;
                  case "kod":         return <SortableTh key={key} label="Kod" current={sortBy} sortKey="kod" dir={sortDir} onClick={setSort} className="py-2" />;
                  case "barkod_col":  return <th key={key} className="px-3 py-2">Barkod</th>;
                  case "alt_kateq":   return <th key={key} className="px-3 py-2">Alt kataloq</th>;
                  case "marka":       return <th key={key} className="px-3 py-2">Marka</th>;
                  case "model":       return <th key={key} className="px-3 py-2">Model</th>;
                  case "rang":        return <th key={key} className="px-3 py-2">Rəng</th>;
                  case "istehsalci":  return <th key={key} className="px-3 py-2">İstehsalçı</th>;
                  case "olcu":        return <th key={key} className="px-3 py-2">Ölçü</th>;
                  case "anbar":       return <SortableTh key={key} label="Anbar" current={sortBy} sortKey="anbar" dir={sortDir} onClick={setSort} className="py-2" />;
                  case "qaliq":       return <SortableTh key={key} label="Qalıq" current={sortBy} sortKey="qaliq" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "rezerv":      return <SortableTh key={key} label="Rezerv" current={sortBy} sortKey="rezerv" dir={sortDir} onClick={setSort} align="right" className="py-2" title="Aktiv bron miqdarı" />;
                  case "movcud":      return <SortableTh key={key} label="Mövcud" current={sortBy} sortKey="movcud" dir={sortDir} onClick={setSort} align="right" className="py-2" title="Mövcud (free) = Qalıq − Rezerv" />;
                  case "min":         return <SortableTh key={key} label="Min." current={sortBy} sortKey="min" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "kritik":      return <th key={key} className={`px-3 py-2 ${align}`}>Kritik</th>;
                  case "max":         return <th key={key} className={`px-3 py-2 ${align}`}>Maks.</th>;
                  case "alish":       return <SortableTh key={key} label="Maya" current={sortBy} sortKey="alish" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "satis":       return <SortableTh key={key} label="Satış" current={sortBy} sortKey="satis" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "qiymet":      return <SortableTh key={key} label="Son qiymət" current={sortBy} sortKey="qiymet" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "deyer":       return <SortableTh key={key} label="Cəm dəyər" current={sortBy} sortKey="deyer" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "valyuta":     return <th key={key} className="px-3 py-2">Valyuta</th>;
                  case "edv":         return <th key={key} className="px-3 py-2">ƏDV</th>;
                  case "zemanet":     return <th key={key} className={`px-3 py-2 ${align}`}>Zəmanət</th>;
                  case "etiketsiz":   return <th key={key} className="px-3 py-2">Etiketsiz</th>;
                  case "yaradildi":   return <th key={key} className="px-3 py-2">Yaradıldı</th>;
                  case "son_hereket": return <SortableTh key={key} label="Son hərəkət" current={sortBy} sortKey="son_hereket" dir={sortDir} onClick={setSort} className="py-2" />;
                  case "son_ay_say":  return <SortableTh key={key} label="30 günlük say" current={sortBy} sortKey="son_ay_say" dir={sortDir} onClick={setSort} align="right" className="py-2" />;
                  case "qisa_tesvir": return <th key={key} className="px-3 py-2">Qısaca təsvir</th>;
                  case "aciqlama":    return <th key={key} className="px-3 py-2">Məhsul haqqında</th>;
                  case "status_col":  return <th key={key} className="px-3 py-2">Status</th>;
                  case "servis_col":  return <th key={key} className={`px-3 py-2 ${align}`}>Servis rəyi</th>;
                  default: return null;
                }
              })}
              <th className="px-3 py-2 text-right w-32">Əməl</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={cols.order.length + 1} className="py-12 text-center text-sm text-muted-foreground">Stok yoxdur</td></tr>
            )}
            {sorted.map((r) => {
              const rowCls = r.status === "yox"
                ? "bg-danger/5 hover:bg-danger/10"
                : r.status === "az"
                ? "bg-warning/5 hover:bg-warning/10"
                : "hover:bg-secondary/30";
              const fmtNum = r.miqdar % 1 === 0 ? 0 : 2;
              const cells: Record<string, React.ReactNode> = {
                sekil_col: (
                  <td key="sekil_col" className="px-3 py-2">
                    {r.sekil_url ? (
                      <Image
                        src={r.sekil_url}
                        alt={r.ad}
                        width={36}
                        height={36}
                        className="rounded-md object-cover border border-border/40"
                      />
                    ) : (
                      <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-muted-foreground">
                        <Package className="h-3.5 w-3.5 opacity-50" />
                      </div>
                    )}
                  </td>
                ),
                mehsul: (
                  <td key="mehsul" className="px-3 py-2">
                    <div className="min-w-0">
                      <Link href={`/anbar/mehsullar/${r.mehsul_id}`} className="font-medium hover:text-primary">{r.ad}</Link>
                      {!cols.isVisible("barkod_col") && r.barkod && (
                        <div className="text-[10.5px] font-mono text-muted-foreground">{r.barkod}</div>
                      )}
                    </div>
                  </td>
                ),
                kod: (
                  <td key="kod" className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.kod ?? "—"}</td>
                ),
                barkod_col: (
                  <td key="barkod_col" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.barkod ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="font-mono">{r.barkod}</span>
                        <CopyButton value={r.barkod} title="Barkodu kopya et" size="xs" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
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
                model: (
                  <td key="model" className="px-3 py-2 text-xs">{r.model ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                rang: (
                  <td key="rang" className="px-3 py-2 text-xs">{r.rang ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                istehsalci: (
                  <td key="istehsalci" className="px-3 py-2 text-xs">{r.istehsalci ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                olcu: (
                  <td key="olcu" className="px-3 py-2 text-xs">{r.vahid ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                anbar: (
                  <td key="anbar" className="px-3 py-2 text-xs">{r.anbar_ad}</td>
                ),
                qaliq: (
                  <td key="qaliq" className="px-3 py-2 text-right tabular-nums font-semibold">
                    {formatNumber(r.miqdar, fmtNum)}
                    {r.vahid && <span className="ml-1 text-[10px] text-muted-foreground">{r.vahid}</span>}
                  </td>
                ),
                rezerv: (
                  <td key="rezerv" className="px-3 py-2 text-right tabular-nums text-xs">
                    {r.rezerv > 0 ? (
                      <Link href={`/anbar/bron?status=aktiv&q=${encodeURIComponent(r.ad)}`} className="text-warning hover:underline">
                        {formatNumber(r.rezerv, fmtNum)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                ),
                movcud: (
                  <td key="movcud" className="px-3 py-2 text-right tabular-nums font-semibold">
                    <span className={r.movcud <= 0 ? "text-danger" : ""}>{formatNumber(r.movcud, fmtNum)}</span>
                  </td>
                ),
                min: (
                  <td key="min" className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {r.min_stok ? formatNumber(r.min_stok, 0) : "—"}
                  </td>
                ),
                kritik: (
                  <td key="kritik" className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {r.kritik_stok != null ? formatNumber(r.kritik_stok, 0) : "—"}
                  </td>
                ),
                max: (
                  <td key="max" className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {r.max_stok != null ? formatNumber(r.max_stok, 0) : "—"}
                  </td>
                ),
                alish: (
                  <td key="alish" className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {r.alish_qiymeti > 0 ? formatMoney(r.alish_qiymeti) : "—"}
                  </td>
                ),
                satis: (
                  <td key="satis" className="px-3 py-2 text-right tabular-nums text-xs">
                    {r.satis_qiymeti > 0 ? formatMoney(r.satis_qiymeti) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                qiymet: (
                  <td key="qiymet" className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {formatMoney(r.son_qiymet)}
                  </td>
                ),
                deyer: (
                  <td key="deyer" className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(r.cem_deyer)}</td>
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
                  <td key="zemanet" className="px-3 py-2 text-right tabular-nums text-xs">
                    {r.zemanet_ay > 0 ? `${r.zemanet_ay} ay` : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                etiketsiz: (
                  <td key="etiketsiz" className="px-3 py-2 text-xs">
                    {r.etiketsiz ? <Badge variant="outline" className="text-[10px]">Etiketsiz</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                yaradildi: (
                  <td key="yaradildi" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.yaradildi ? new Date(r.yaradildi).toLocaleDateString("az-AZ") : "—"}
                  </td>
                ),
                son_hereket: (
                  <td key="son_hereket" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.son_hereket_de ? new Date(r.son_hereket_de).toLocaleDateString("az-AZ") : <span className="text-muted-foreground/50">heç vaxt</span>}
                  </td>
                ),
                son_ay_say: (
                  <td key="son_ay_say" className="px-3 py-2 text-right tabular-nums text-xs">
                    {r.son_ay_hereket_say > 0 ? r.son_ay_hereket_say : <span className="text-muted-foreground">0</span>}
                  </td>
                ),
                qisa_tesvir: (
                  <td key="qisa_tesvir" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.qisaca_tesvir ? <span className="line-clamp-2 max-w-xs" title={r.qisaca_tesvir}>{r.qisaca_tesvir}</span> : "—"}
                  </td>
                ),
                status_col: (
                  <td key="status_col" className="px-3 py-2">
                    {r.aktiv ? (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Aktiv</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Passiv</Badge>
                    )}
                  </td>
                ),
                servis_col: (
                  <td key="servis_col" className="px-3 py-2 text-right">
                    {r.servis_sayi > 0 ? (
                      <Link href={`/servis?q=${encodeURIComponent(r.ad)}`} className="inline-flex items-center gap-1 text-xs hover:text-primary">
                        <span className="font-semibold tabular-nums">{r.servis_sayi}</span>
                        <span className="text-[10px] text-muted-foreground">qeyd</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                aciqlama: (
                  <td key="aciqlama" className="px-3 py-2 text-xs text-muted-foreground">
                    {r.aciqlamaq ? (
                      <span className="line-clamp-2 max-w-xs" title={r.aciqlamaq}>{r.aciqlamaq}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ),
              };
              return (
                <tr key={`${r.stok_id}`} className={`border-b border-border/20 transition ${rowCls}`}>
                  {cols.order.map((k) => (cols.isVisible(k) ? cells[k] : null))}
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-0.5">
                      <StockAdjustDialog
                        mehsulId={r.mehsul_id}
                        mehsulAd={r.ad}
                        anbarlar={[{ id: r.anbar_id, ad: r.anbar_ad }, ...anbarlar.filter((a) => a.id !== r.anbar_id)]}
                        currentStock={r.miqdar}
                        initialAnbarId={r.anbar_id}
                        initialNov="medaxil"
                        trigger={
                          <button title="Mədaxil" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-success hover:bg-success/10">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        }
                      />
                      <StockAdjustDialog
                        mehsulId={r.mehsul_id}
                        mehsulAd={r.ad}
                        anbarlar={[{ id: r.anbar_id, ad: r.anbar_ad }, ...anbarlar.filter((a) => a.id !== r.anbar_id)]}
                        currentStock={r.miqdar}
                        initialAnbarId={r.anbar_id}
                        initialNov="mexaric"
                        trigger={
                          <button title="Məxaric" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-danger hover:bg-danger/10">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                        }
                      />
                      <StockAdjustDialog
                        mehsulId={r.mehsul_id}
                        mehsulAd={r.ad}
                        anbarlar={[{ id: r.anbar_id, ad: r.anbar_ad }, ...anbarlar.filter((a) => a.id !== r.anbar_id)]}
                        currentStock={r.miqdar}
                        initialAnbarId={r.anbar_id}
                        initialNov="inventar"
                        trigger={
                          <button title="Sayım / inventar düzəliş" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-warning hover:bg-warning/10">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          </button>
                        }
                      />
                      {anbarlar.length >= 2 && (
                        <TransferDialog
                          anbarlar={[{ id: r.anbar_id, ad: r.anbar_ad }, ...anbarlar.filter((a) => a.id !== r.anbar_id)]}
                          trigger={
                            <button title="Bu məhsulu başqa anbara köçür" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-info hover:bg-info/10">
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                            </button>
                          }
                        />
                      )}
                      <Link
                        href={`/anbar/hereketler?q=${encodeURIComponent(r.kod ?? r.barkod ?? r.ad)}`}
                        title="Bu məhsulun bütün hərəkətləri"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <History className="h-3.5 w-3.5" />
                      </Link>
                    </div>
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
