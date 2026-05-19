"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { formatDate, formatMoney } from "@/lib/utils";
import type { KassaRow } from "../kassa-queries";

type Props = { items: KassaRow[] };

const STORAGE_KEY = "maliyye-kassalar-cols-v1";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "ad",                label: "Ad", required: true },
  { key: "status_col",        label: "Status" },
  { key: "balans",            label: "Balans" },
  { key: "filial",            label: "Filial" },
  { key: "sahibkar_col",      label: "Sahibkar" },
  { key: "kassa_aparati",     label: "Kassa aparatı" },
  { key: "acan",              label: "Açan kassir" },
  { key: "baglayan",          label: "Bağlayan kassir" },
  { key: "acilis_tarix",      label: "Açılış vaxtı" },
  { key: "baglanis_tarix",    label: "Bağlanış vaxtı" },
  { key: "acilis_qaligi_col", label: "Açılış balansı" },
  { key: "hesablanan_col",    label: "Gözlənilən qalıq" },
  { key: "baglanis_qaliq",    label: "Faktiki qalıq" },
  { key: "fark_col",          label: "Fərq" },
  { key: "medaxil_cem",       label: "Mədaxil cəmi" },
  { key: "mexaric_cem",       label: "Məxaric cəmi" },
  { key: "bugun_dovriyye",    label: "Gündəlik dövriyyə" },
  { key: "son_emeliyyat",     label: "Son əməliyyat" },
  { key: "son_emeliyyat_de",  label: "Son əməliyyat tarix" },
  { key: "valyuta",           label: "Valyuta" },
  { key: "yaradildi_col",     label: "Yaradılma vaxtı" },
  { key: "yenilendi_col",     label: "Son düzəliş" },
  { key: "qeyd_col",          label: "Qeyd" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  ad: true,
  status_col: true,
  balans: true,
  filial: false,
  sahibkar_col: false,
  kassa_aparati: false,
  acan: false,
  baglayan: false,
  acilis_tarix: false,
  baglanis_tarix: false,
  acilis_qaligi_col: false,
  hesablanan_col: false,
  baglanis_qaliq: false,
  fark_col: false,
  medaxil_cem: false,
  mexaric_cem: false,
  bugun_dovriyye: false,
  son_emeliyyat: false,
  son_emeliyyat_de: false,
  valyuta: false,
  yaradildi_col: false,
  yenilendi_col: false,
  qeyd_col: false,
};

type SortKey = "ad" | "balans" | "son_emeliyyat" | "dovriyye" | "medaxil" | "mexaric";

export function KassalarTable({ items }: Props) {
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
        case "ad": return cmpStr(a.ad, b.ad);
        case "balans": return cmpNum(a.balans, b.balans);
        case "son_emeliyyat": return cmpDate(a.son_emeliyyat_de, b.son_emeliyyat_de);
        case "dovriyye": return cmpNum(a.bugun_dovriyye, b.bugun_dovriyye);
        case "medaxil": return cmpNum(a.medaxil_cem, b.medaxil_cem);
        case "mexaric": return cmpNum(a.mexaric_cem, b.mexaric_cem);
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Kassalar <span className="ml-2 text-xs font-normal text-muted-foreground">{items.length} qeyd</span>
        </h3>
        {cols.render()}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {cols.order.map((key) => {
                if (!cols.isVisible(key)) return null;
                switch (key) {
                  case "ad":                return <SortableTh key={key} label="Ad" current={sortBy} sortKey="ad" dir={sortDir} onClick={setSort} />;
                  case "status_col":        return <th key={key} className="px-3 py-2.5">Status</th>;
                  case "balans":            return <SortableTh key={key} label="Balans" current={sortBy} sortKey="balans" dir={sortDir} onClick={setSort} align="right" />;
                  case "filial":            return <th key={key} className="px-3 py-2.5">Filial</th>;
                  case "sahibkar_col":      return <th key={key} className="px-3 py-2.5">Sahibkar</th>;
                  case "kassa_aparati":     return <th key={key} className="px-3 py-2.5">Aparat</th>;
                  case "acan":              return <th key={key} className="px-3 py-2.5">Açan</th>;
                  case "baglayan":          return <th key={key} className="px-3 py-2.5">Bağlayan</th>;
                  case "acilis_tarix":      return <th key={key} className="px-3 py-2.5">Açılış</th>;
                  case "baglanis_tarix":    return <th key={key} className="px-3 py-2.5">Bağlanış</th>;
                  case "acilis_qaligi_col": return <th key={key} className="px-3 py-2.5 text-right">Açılış balansı</th>;
                  case "hesablanan_col":    return <th key={key} className="px-3 py-2.5 text-right">Gözlənilən</th>;
                  case "baglanis_qaliq":    return <th key={key} className="px-3 py-2.5 text-right">Faktiki</th>;
                  case "fark_col":          return <th key={key} className="px-3 py-2.5 text-right">Fərq</th>;
                  case "medaxil_cem":       return <SortableTh key={key} label="Mədaxil" current={sortBy} sortKey="medaxil" dir={sortDir} onClick={setSort} align="right" />;
                  case "mexaric_cem":       return <SortableTh key={key} label="Məxaric" current={sortBy} sortKey="mexaric" dir={sortDir} onClick={setSort} align="right" />;
                  case "bugun_dovriyye":    return <SortableTh key={key} label="Gündəlik" current={sortBy} sortKey="dovriyye" dir={sortDir} onClick={setSort} align="right" />;
                  case "son_emeliyyat":     return <th key={key} className="px-3 py-2.5 text-right">Son əməliyyat</th>;
                  case "son_emeliyyat_de":  return <SortableTh key={key} label="Son əməl. tarix" current={sortBy} sortKey="son_emeliyyat" dir={sortDir} onClick={setSort} />;
                  case "valyuta":           return <th key={key} className="px-3 py-2.5">Valyuta</th>;
                  case "yaradildi_col":     return <th key={key} className="px-3 py-2.5">Yaradıldı</th>;
                  case "yenilendi_col":     return <th key={key} className="px-3 py-2.5">Son düzəliş</th>;
                  case "qeyd_col":          return <th key={key} className="px-3 py-2.5">Qeyd</th>;
                  default: return null;
                }
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={cols.order.length} className="py-12 text-center text-sm text-muted-foreground">
                  Kassa yoxdur
                </td>
              </tr>
            )}
            {sorted.map((k) => {
              const isOpen = k.status === "acig";
              const cells: Record<string, React.ReactNode> = {
                ad: (
                  <td key="ad" className="px-3 py-2.5 font-medium">{k.ad}</td>
                ),
                status_col: (
                  <td key="status_col" className="px-3 py-2.5">
                    {isOpen ? (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Açıq</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Bağlı</Badge>
                    )}
                  </td>
                ),
                balans: (
                  <td key="balans" className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    {formatMoney(k.balans)}
                  </td>
                ),
                filial: (
                  <td key="filial" className="px-3 py-2.5 text-xs">{k.filial_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                sahibkar_col: (
                  <td key="sahibkar_col" className="px-3 py-2.5 font-mono text-[10.5px] text-muted-foreground" title={k.sahibkar_id}>
                    {k.sahibkar_id ? k.sahibkar_id.slice(0, 8) : "—"}
                  </td>
                ),
                kassa_aparati: (
                  <td key="kassa_aparati" className="px-3 py-2.5 text-xs">{k.kassa_aparati ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                acan: (
                  <td key="acan" className="px-3 py-2.5 text-xs text-muted-foreground">{k.acan_ad ?? "—"}</td>
                ),
                baglayan: (
                  <td key="baglayan" className="px-3 py-2.5 text-xs text-muted-foreground">{k.baglayan_ad ?? "—"}</td>
                ),
                acilis_tarix: (
                  <td key="acilis_tarix" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {k.acilis_tarixi ? formatDate(k.acilis_tarixi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                baglanis_tarix: (
                  <td key="baglanis_tarix" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {k.baglanis_tarixi ? formatDate(k.baglanis_tarixi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                acilis_qaligi_col: (
                  <td key="acilis_qaligi_col" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {formatMoney(k.acilis_qaligi)}
                  </td>
                ),
                hesablanan_col: (
                  <td key="hesablanan_col" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {k.hesablanan_qaliq != null ? formatMoney(k.hesablanan_qaliq) : "—"}
                  </td>
                ),
                baglanis_qaliq: (
                  <td key="baglanis_qaliq" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {k.baglanis_qaligi != null ? formatMoney(k.baglanis_qaligi) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                fark_col: (
                  <td key="fark_col" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {k.fark != null ? (
                      <span className={k.fark === 0 ? "text-success" : Math.abs(k.fark) < 1 ? "" : "text-danger"}>
                        {k.fark > 0 ? "+" : ""}{formatMoney(k.fark)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                medaxil_cem: (
                  <td key="medaxil_cem" className="px-3 py-2.5 text-right tabular-nums text-xs text-success">
                    {k.medaxil_cem > 0 ? formatMoney(k.medaxil_cem) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                mexaric_cem: (
                  <td key="mexaric_cem" className="px-3 py-2.5 text-right tabular-nums text-xs text-danger">
                    {k.mexaric_cem > 0 ? formatMoney(k.mexaric_cem) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                bugun_dovriyye: (
                  <td key="bugun_dovriyye" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {k.bugun_dovriyye > 0 ? formatMoney(k.bugun_dovriyye) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                son_emeliyyat: (
                  <td key="son_emeliyyat" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {k.son_emeliyyat_mebleg > 0 ? formatMoney(k.son_emeliyyat_mebleg) : "—"}
                  </td>
                ),
                son_emeliyyat_de: (
                  <td key="son_emeliyyat_de" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {k.son_emeliyyat_de ? formatDate(k.son_emeliyyat_de, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                valyuta: (
                  <td key="valyuta" className="px-3 py-2.5 text-xs">AZN</td>
                ),
                yaradildi_col: (
                  <td key="yaradildi_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {k.yaradildi ? formatDate(k.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                yenilendi_col: (
                  <td key="yenilendi_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {k.yenilendi ? formatDate(k.yenilendi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                qeyd_col: (
                  <td key="qeyd_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {k.qeyd ? <span className="line-clamp-2 max-w-xs" title={k.qeyd}>{k.qeyd}</span> : "—"}
                  </td>
                ),
              };
              return (
                <tr key={k.id} className="border-b border-border/30 transition hover:bg-secondary/40">
                  {cols.order.map((kk) => (cols.isVisible(kk) ? cells[kk] : null))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
