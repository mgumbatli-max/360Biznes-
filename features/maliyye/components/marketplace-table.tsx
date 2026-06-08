"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { formatDate, formatMoney } from "@/lib/utils";
import type { MarketplacePaymentRow } from "../marketplace-queries";
import { PayoutAcceptDialog } from "./payout-accept-dialog";

type Props = {
  items: MarketplacePaymentRow[];
  accountOptions?: Array<{ id: string; ad: string; nov: string }>;
};

const STORAGE_KEY = "maliyye-marketplace-cols-v1";

const STATUS_LABEL: Record<string, { ad: string; cls: string }> = {
  gozleyir: { ad: "Gözləyir", cls: "border-warning/30 bg-warning/10 text-warning" },
  odenildi: { ad: "Ödənildi", cls: "border-success/30 bg-success/10 text-success" },
  legv: { ad: "Ləğv", cls: "border-muted text-muted-foreground" },
};

const COLUMN_DEFS: ColumnDef[] = [
  { key: "platforma",  label: "Platforma", required: true },
  { key: "magaza",     label: "Mağaza" },
  { key: "donem",      label: "Dövr" },
  { key: "gozlenen",   label: "Gözlənən" },
  { key: "banka",      label: "Bankaya düşən" },
  { key: "komissiya",  label: "Komissiya" },
  { key: "qaytarma",   label: "Qaytarma" },
  { key: "ferq",       label: "Fərq" },
  { key: "hesab",      label: "Hesab" },
  { key: "status",     label: "Status" },
  { key: "qeyd",       label: "Qeyd" },
  { key: "yaradildi",  label: "Yaradılma" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  platforma: true,
  magaza: false,
  donem: true,
  gozlenen: true,
  banka: true,
  komissiya: true,
  qaytarma: false,
  ferq: true,
  hesab: false,
  status: true,
  qeyd: false,
  yaradildi: false,
};

type SortKey = "platforma" | "donem" | "gozlenen" | "banka" | "ferq" | "status";

export function MarketplaceTable({ items, accountOptions = [] }: Props) {
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
        case "platforma": return a.platforma.localeCompare(b.platforma, "az") * mult;
        case "donem": return (a.donem_bitme.getTime() - b.donem_bitme.getTime()) * mult;
        case "gozlenen": return (a.gozlenen - b.gozlenen) * mult;
        case "banka": return (a.banka_dushen - b.banka_dushen) * mult;
        case "ferq": return (a.ferq - b.ferq) * mult;
        case "status": return a.status.localeCompare(b.status, "az") * mult;
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Marketplace ödənişləri <span className="ml-2 text-xs font-normal text-muted-foreground">{items.length} qeyd</span>
        </h3>
        <div className="flex items-center gap-2">{cols.render()}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {cols.order.map((key) => {
                if (!cols.isVisible(key)) return null;
                switch (key) {
                  case "platforma": return <SortableTh key={key} label="Platforma" current={sortBy} sortKey="platforma" dir={sortDir} onClick={setSort} />;
                  case "magaza": return <th key={key} className="px-3 py-2.5">Mağaza</th>;
                  case "donem": return <SortableTh key={key} label="Dövr" current={sortBy} sortKey="donem" dir={sortDir} onClick={setSort} />;
                  case "gozlenen": return <SortableTh key={key} label="Gözlənən" current={sortBy} sortKey="gozlenen" dir={sortDir} onClick={setSort} align="right" />;
                  case "banka": return <SortableTh key={key} label="Bankaya" current={sortBy} sortKey="banka" dir={sortDir} onClick={setSort} align="right" />;
                  case "komissiya": return <th key={key} className="px-3 py-2.5 text-right">Komissiya</th>;
                  case "qaytarma": return <th key={key} className="px-3 py-2.5 text-right">Qaytarma</th>;
                  case "ferq": return <SortableTh key={key} label="Fərq" current={sortBy} sortKey="ferq" dir={sortDir} onClick={setSort} align="right" />;
                  case "hesab": return <th key={key} className="px-3 py-2.5">Hesab</th>;
                  case "status": return <SortableTh key={key} label="Status" current={sortBy} sortKey="status" dir={sortDir} onClick={setSort} />;
                  case "qeyd": return <th key={key} className="px-3 py-2.5">Qeyd</th>;
                  case "yaradildi": return <th key={key} className="px-3 py-2.5">Yaradılma</th>;
                  default: return null;
                }
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={cols.order.length} className="py-12 text-center text-sm text-muted-foreground">
                  Marketplace ödənişi tapılmadı
                </td>
              </tr>
            )}
            {sorted.map((m) => {
              const status = STATUS_LABEL[m.status] ?? { ad: m.status, cls: "border-muted text-muted-foreground" };
              const cells: Record<string, React.ReactNode> = {
                platforma: (
                  <td key="platforma" className="px-3 py-2.5 font-medium">
                    <Badge variant="secondary" className="text-[10px]">{m.platforma}</Badge>
                  </td>
                ),
                magaza: <td key="magaza" className="px-3 py-2.5 text-xs">{m.magaza ?? <span className="text-muted-foreground">—</span>}</td>,
                donem: (
                  <td key="donem" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {formatDate(m.donem_baslama)} → {formatDate(m.donem_bitme)}
                  </td>
                ),
                gozlenen: <td key="gozlenen" className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatMoney(m.gozlenen)}</td>,
                banka: <td key="banka" className="px-3 py-2.5 text-right tabular-nums font-semibold text-success">{formatMoney(m.banka_dushen)}</td>,
                komissiya: <td key="komissiya" className="px-3 py-2.5 text-right tabular-nums text-xs text-warning">{formatMoney(m.komissiya)}</td>,
                qaytarma: <td key="qaytarma" className="px-3 py-2.5 text-right tabular-nums text-xs text-danger">{formatMoney(m.qaytarma)}</td>,
                ferq: (
                  <td key="ferq" className={`px-3 py-2.5 text-right tabular-nums text-xs ${m.ferq < 0 ? "text-danger" : "text-muted-foreground"}`}>
                    {m.ferq > 0 ? "+" : ""}{formatMoney(m.ferq)}
                  </td>
                ),
                hesab: <td key="hesab" className="px-3 py-2.5 text-xs">{m.hesab_ad ?? <span className="text-muted-foreground">—</span>}</td>,
                status: (
                  <td key="status" className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${status.cls}`}>{status.ad}</Badge>
                      {m.status === "gozleyir" && accountOptions.length > 0 && (
                        <PayoutAcceptDialog
                          payoutId={String(m.id)}
                          platforma={m.platforma}
                          gozlenen={Number(m.gozlenen)}
                          defaultHesabId={m.hesab_id}
                          accountOptions={accountOptions}
                        />
                      )}
                    </div>
                  </td>
                ),
                qeyd: (
                  <td key="qeyd" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {m.qeyd ? <span className="line-clamp-2 max-w-xs" title={m.qeyd}>{m.qeyd}</span> : "—"}
                  </td>
                ),
                yaradildi: (
                  <td key="yaradildi" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {m.yaradildi ? formatDate(m.yaradildi, { day: "2-digit", month: "short" }) : "—"}
                  </td>
                ),
              };
              return (
                <tr key={m.id} className="border-b border-border/30 transition hover:bg-secondary/40">
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
