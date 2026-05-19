"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { formatDate, formatMoney } from "@/lib/utils";
import type { AccountRow } from "../account-queries";

type Props = { items: AccountRow[] };

const STORAGE_KEY = "maliyye-hesab-cols-v1";

const NOV_LABEL: Record<string, { ad: string; cls: string }> = {
  negd: { ad: "Nağd", cls: "border-success/30 bg-success/10 text-success" },
  bank: { ad: "Bank", cls: "border-info/30 bg-info/10 text-info" },
  kart: { ad: "Kart", cls: "border-primary/30 bg-primary/10 text-primary-light" },
  e_pul: { ad: "E-pul", cls: "border-warning/30 bg-warning/10 text-warning" },
  kassa: { ad: "Kassa", cls: "border-amber-500/30 bg-amber-500/10 text-amber-500" },
  diger: { ad: "Digər", cls: "border-muted text-muted-foreground" },
};

const COLUMN_DEFS: ColumnDef[] = [
  { key: "ad",            label: "Ad", required: true },
  { key: "nov",           label: "Növ" },
  { key: "bank",          label: "Bank" },
  { key: "iban",          label: "IBAN" },
  { key: "kart_son4",     label: "Kart son 4" },
  { key: "qaliq",         label: "Balans" },
  { key: "valyuta",       label: "Valyuta" },
  { key: "dovriyye",      label: "Bugün dövriyyə" },
  { key: "son_emeliyyat", label: "Son əməliyyat" },
  { key: "filial",        label: "Filial" },
  { key: "mesul",         label: "Məsul şəxs" },
  { key: "aktiv",         label: "Aktiv" },
  { key: "qeyd",          label: "Qeyd" },
  { key: "yaradildi",     label: "Yaradılma" },
  { key: "yenilendi",     label: "Son düzəliş" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  ad: true,
  nov: true,
  bank: true,
  iban: false,
  kart_son4: false,
  qaliq: true,
  valyuta: true,
  dovriyye: false,
  son_emeliyyat: true,
  filial: false,
  mesul: false,
  aktiv: true,
  qeyd: false,
  yaradildi: false,
  yenilendi: false,
};

type SortKey = "ad" | "qaliq" | "nov" | "son_emeliyyat";

export function AccountsTable({ items }: Props) {
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
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case "ad": return (a.ad ?? "").localeCompare(b.ad ?? "", "az") * mult;
        case "nov": return (a.nov ?? "").localeCompare(b.nov ?? "", "az") * mult;
        case "qaliq": return (a.qaliq - b.qaliq) * mult;
        case "son_emeliyyat":
          return ((a.son_emeliyyat_de?.getTime() ?? 0) - (b.son_emeliyyat_de?.getTime() ?? 0)) * mult;
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  const cemAZN = items.filter((i) => i.valyuta === "AZN").reduce((s, x) => s + x.qaliq, 0);

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Hesablar <span className="ml-2 text-xs font-normal text-muted-foreground">{items.length} hesab</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums">Cəm (AZN): {formatMoney(cemAZN)}</span>
          {cols.render()}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {cols.order.map((key) => {
                if (!cols.isVisible(key)) return null;
                switch (key) {
                  case "ad": return <SortableTh key={key} label="Ad" current={sortBy} sortKey="ad" dir={sortDir} onClick={setSort} />;
                  case "nov": return <SortableTh key={key} label="Növ" current={sortBy} sortKey="nov" dir={sortDir} onClick={setSort} />;
                  case "bank": return <th key={key} className="px-3 py-2.5">Bank</th>;
                  case "iban": return <th key={key} className="px-3 py-2.5">IBAN</th>;
                  case "kart_son4": return <th key={key} className="px-3 py-2.5">Kart son 4</th>;
                  case "qaliq": return <SortableTh key={key} label="Balans" current={sortBy} sortKey="qaliq" dir={sortDir} onClick={setSort} align="right" />;
                  case "valyuta": return <th key={key} className="px-3 py-2.5">Valyuta</th>;
                  case "dovriyye": return <th key={key} className="px-3 py-2.5 text-right">Bugün dövriyyə</th>;
                  case "son_emeliyyat": return <SortableTh key={key} label="Son əməliyyat" current={sortBy} sortKey="son_emeliyyat" dir={sortDir} onClick={setSort} />;
                  case "filial": return <th key={key} className="px-3 py-2.5">Filial</th>;
                  case "mesul": return <th key={key} className="px-3 py-2.5">Məsul şəxs</th>;
                  case "aktiv": return <th key={key} className="px-3 py-2.5">Aktiv</th>;
                  case "qeyd": return <th key={key} className="px-3 py-2.5">Qeyd</th>;
                  case "yaradildi": return <th key={key} className="px-3 py-2.5">Yaradılma</th>;
                  case "yenilendi": return <th key={key} className="px-3 py-2.5">Son düzəliş</th>;
                  default: return null;
                }
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={cols.order.length} className="py-12 text-center text-sm text-muted-foreground">
                  Hesab yoxdur
                </td>
              </tr>
            )}
            {sorted.map((a) => {
              const nov = NOV_LABEL[a.nov] ?? { ad: a.nov, cls: "border-muted text-muted-foreground" };
              const cells: Record<string, React.ReactNode> = {
                ad: <td key="ad" className="px-3 py-2.5 font-medium">{a.ad}</td>,
                nov: (
                  <td key="nov" className="px-3 py-2.5">
                    <Badge variant="outline" className={`text-[10px] ${nov.cls}`}>{nov.ad}</Badge>
                  </td>
                ),
                bank: <td key="bank" className="px-3 py-2.5 text-xs">{a.bank_adi ?? <span className="text-muted-foreground">—</span>}</td>,
                iban: <td key="iban" className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{a.iban ?? "—"}</td>,
                kart_son4: <td key="kart_son4" className="px-3 py-2.5 font-mono text-xs">{a.kart_son4 ? `**** ${a.kart_son4}` : "—"}</td>,
                qaliq: <td key="qaliq" className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatMoney(a.qaliq)}</td>,
                valyuta: <td key="valyuta" className="px-3 py-2.5 text-xs">{a.valyuta}</td>,
                dovriyye: (
                  <td key="dovriyye" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {a.bugun_dovriyye > 0 ? formatMoney(a.bugun_dovriyye) : "—"}
                  </td>
                ),
                son_emeliyyat: (
                  <td key="son_emeliyyat" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {a.son_emeliyyat_de ? formatDate(a.son_emeliyyat_de, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                filial: <td key="filial" className="px-3 py-2.5 text-xs">{a.filial_ad ?? <span className="text-muted-foreground">—</span>}</td>,
                mesul: <td key="mesul" className="px-3 py-2.5 text-xs">{a.mesul_ad ?? <span className="text-muted-foreground">—</span>}</td>,
                aktiv: (
                  <td key="aktiv" className="px-3 py-2.5">
                    {a.aktiv ? (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Aktiv</Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted text-muted-foreground text-[10px]">Passiv</Badge>
                    )}
                  </td>
                ),
                qeyd: (
                  <td key="qeyd" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {a.qeyd ? <span className="line-clamp-2 max-w-xs" title={a.qeyd}>{a.qeyd}</span> : "—"}
                  </td>
                ),
                yaradildi: (
                  <td key="yaradildi" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {a.yaradildi ? formatDate(a.yaradildi, { day: "2-digit", month: "short" }) : "—"}
                  </td>
                ),
                yenilendi: (
                  <td key="yenilendi" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {a.yenilendi ? formatDate(a.yenilendi, { day: "2-digit", month: "short" }) : "—"}
                  </td>
                ),
              };
              return (
                <tr key={a.id} className="border-b border-border/30 transition hover:bg-secondary/40">
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
