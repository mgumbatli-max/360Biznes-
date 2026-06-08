"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Printer as PrinterIcon,
  User,
  Truck,
  Building2,
  Receipt,
  ShoppingCart,
  Wrench,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { formatDate, formatMoney } from "@/lib/utils";
import type { OperationRow } from "../operations-queries";
import { OperationRowActions } from "./operation-row-actions";
import { RowIconButton, RowIconGroup } from "@/features/shared/row-icon-button";
import { SaleStatusBadge } from "@/features/ticaret/components/sale-status-badge";

function kontragentRoute(id: string, nov: string | null): string {
  // her_ikisi → defaultda müştəri profili (oradan təchizatçı tab açıla bilər)
  if (nov === "techizatci") return `/elaqe/techizatcilar/${id}`;
  return `/elaqe/musteriler/${id}`;
}

type Props = {
  items: OperationRow[];
  total: number;
  canApprove?: boolean;
  canCancel?: boolean;
};

const STORAGE_KEY = "maliyye-emeliyyat-cols-v1";

const STATUS_LABEL: Record<string, { ad: string; cls: string }> = {
  aktiv: { ad: "Aktiv", cls: "border-success/30 bg-success/10 text-success" },
  gozleyen_tesdiq: { ad: "Təsdiq gözləyir", cls: "border-warning/30 bg-warning/10 text-warning" },
  legv: { ad: "Ləğv", cls: "border-muted text-muted-foreground" },
  redd: { ad: "Rədd", cls: "border-danger/30 bg-danger/10 text-danger" },
};

const COLUMN_DEFS: ColumnDef[] = [
  { key: "tarix",         label: "Tarix", required: true },
  { key: "saat",          label: "Saat" },
  { key: "nov",           label: "Növ" },
  { key: "qrup",          label: "Qrup" },
  { key: "yon",           label: "Yön" },
  { key: "hesab",         label: "Hesab" },
  { key: "hesab2",        label: "Hədəf hesab" },
  { key: "kontragent",    label: "Kontragent" },
  { key: "isci",          label: "İşçi" },
  { key: "mebleg",        label: "Məbləğ" },
  { key: "valyuta",       label: "Valyuta" },
  { key: "mezenne",       label: "Məzənnə" },
  { key: "azn_mebleg",    label: "AZN" },
  { key: "komissiya",     label: "Komissiya" },
  { key: "sened",         label: "Sənəd №" },
  { key: "status",        label: "Status" },
  { key: "qeyd",          label: "Qeyd" },
  { key: "yaradan",       label: "Yaradan" },
  { key: "yaradildi",     label: "Yaradılma" },
  { key: "actions",       label: "Əməl", required: true },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  tarix: true,
  saat: false,
  nov: true,
  qrup: false,
  yon: true,
  hesab: true,
  hesab2: false,
  kontragent: true,
  isci: false,
  mebleg: true,
  valyuta: false,
  mezenne: false,
  azn_mebleg: false,
  komissiya: false,
  sened: false,
  status: true,
  qeyd: false,
  yaradan: false,
  yaradildi: false,
  actions: true,
};

type SortKey = "tarix" | "mebleg" | "azn" | "yon" | "status";

export function OperationsTable({ items, total, canApprove = false, canCancel = false }: Props) {
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
        case "mebleg": return cmpNum(a.mebleg, b.mebleg);
        case "azn": return cmpNum(a.azn_mebleg, b.azn_mebleg);
        case "yon": return cmpStr(a.yon, b.yon);
        case "status": return cmpStr(a.status, b.status);
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Əməliyyatlar <span className="ml-2 text-xs font-normal text-muted-foreground">{total} qeyd</span>
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
                  case "tarix": return <SortableTh key={key} label="Tarix" current={sortBy} sortKey="tarix" dir={sortDir} onClick={setSort} />;
                  case "saat": return <th key={key} className="px-3 py-2.5">Saat</th>;
                  case "nov": return <th key={key} className="px-3 py-2.5">Növ</th>;
                  case "qrup": return <th key={key} className="px-3 py-2.5">Qrup</th>;
                  case "yon": return <SortableTh key={key} label="Yön" current={sortBy} sortKey="yon" dir={sortDir} onClick={setSort} />;
                  case "hesab": return <th key={key} className="px-3 py-2.5">Hesab</th>;
                  case "hesab2": return <th key={key} className="px-3 py-2.5">Hədəf hesab</th>;
                  case "kontragent": return <th key={key} className="px-3 py-2.5">Kontragent</th>;
                  case "isci": return <th key={key} className="px-3 py-2.5">İşçi</th>;
                  case "mebleg": return <SortableTh key={key} label="Məbləğ" current={sortBy} sortKey="mebleg" dir={sortDir} onClick={setSort} align="right" />;
                  case "valyuta": return <th key={key} className="px-3 py-2.5">Valyuta</th>;
                  case "mezenne": return <th key={key} className="px-3 py-2.5 text-right">Məzənnə</th>;
                  case "azn_mebleg": return <SortableTh key={key} label="AZN" current={sortBy} sortKey="azn" dir={sortDir} onClick={setSort} align="right" />;
                  case "komissiya": return <th key={key} className="px-3 py-2.5 text-right">Komissiya</th>;
                  case "sened": return <th key={key} className="px-3 py-2.5">Sənəd №</th>;
                  case "status": return <SortableTh key={key} label="Status" current={sortBy} sortKey="status" dir={sortDir} onClick={setSort} />;
                  case "qeyd": return <th key={key} className="px-3 py-2.5">Qeyd</th>;
                  case "yaradan": return <th key={key} className="px-3 py-2.5">Yaradan</th>;
                  case "yaradildi": return <th key={key} className="px-3 py-2.5">Yaradılma</th>;
                  case "actions": return <th key={key} className="px-3 py-2.5 text-right">Əməl</th>;
                  default: return null;
                }
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={cols.order.length} className="py-12 text-center text-sm text-muted-foreground">
                  Əməliyyat tapılmadı
                </td>
              </tr>
            )}
            {sorted.map((o) => {
              const status = STATUS_LABEL[o.status] ?? { ad: o.status, cls: "border-muted text-muted-foreground" };
              const yonCls = o.yon === "daxil" ? "text-success" : o.yon === "xaric" ? "text-danger" : "text-primary-light";
              const yonSign = o.yon === "daxil" ? "+" : o.yon === "xaric" ? "−" : "";

              const cells: Record<string, React.ReactNode> = {
                tarix: (
                  <td key="tarix" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(o.tarix).toLocaleDateString("az-AZ")}
                  </td>
                ),
                saat: (
                  <td key="saat" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {o.yaradildi ? formatDate(o.yaradildi, { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                nov: (
                  <td key="nov" className="px-3 py-2.5 text-xs">
                    {o.type_emoji && <span className="mr-1">{o.type_emoji}</span>}{o.type_ad}
                  </td>
                ),
                qrup: (
                  <td key="qrup" className="px-3 py-2.5 text-xs text-muted-foreground">{o.type_qrup}</td>
                ),
                yon: (
                  <td key="yon" className={`px-3 py-2.5 text-xs font-semibold ${yonCls}`}>{o.yon}</td>
                ),
                hesab: (
                  <td key="hesab" className="px-3 py-2.5 text-xs">
                    {o.hesab_ad ? (
                      <Link
                        href={`/maliyye/hesab/${o.hesab_id}`}
                        className="group/link inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-primary/10 hover:text-primary"
                        title="Hesab detalı"
                      >
                        <Building2 className="h-3 w-3 opacity-60 group-hover/link:opacity-100" />
                        <span className="font-medium">{o.hesab_ad}</span>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                hesab2: (
                  <td key="hesab2" className="px-3 py-2.5 text-xs">
                    {o.hesab2_ad ? (
                      <Link
                        href={`/maliyye/hesab/${o.hesab2_id}`}
                        className="group/link inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-primary/10 hover:text-primary"
                        title="Hədəf hesab detalı"
                      >
                        <Building2 className="h-3 w-3 opacity-60 group-hover/link:opacity-100" />
                        <span className="font-medium">{o.hesab2_ad}</span>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                kontragent: (
                  <td key="kontragent" className="px-3 py-2.5 text-xs">
                    {o.kontragent_id && o.kontragent_ad ? (
                      <Link
                        href={kontragentRoute(o.kontragent_id, o.kontragent_nov)}
                        className="group/link inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-primary/10 hover:text-primary"
                        title={o.kontragent_nov === "techizatci" ? "Təchizatçı profili" : "Müştəri profili"}
                      >
                        {o.kontragent_nov === "techizatci" ? (
                          <Truck className="h-3 w-3 opacity-60 group-hover/link:opacity-100" />
                        ) : (
                          <User className="h-3 w-3 opacity-60 group-hover/link:opacity-100" />
                        )}
                        <span className="font-medium">{o.kontragent_ad}</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover/link:opacity-60" />
                      </Link>
                    ) : o.qarsi_teref ? (
                      <span className="text-muted-foreground italic">{o.qarsi_teref}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                isci: (
                  <td key="isci" className="px-3 py-2.5 text-xs">
                    {o.isci_id && o.isci_ad ? (
                      <Link
                        href={`/iscilier/${o.isci_id}`}
                        className="group/link inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-primary/10 hover:text-primary"
                        title="İşçi profili"
                      >
                        <User className="h-3 w-3 opacity-60 group-hover/link:opacity-100" />
                        <span className="font-medium">{o.isci_ad}</span>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                mebleg: (
                  <td key="mebleg" className={`px-3 py-2.5 text-right tabular-nums font-semibold ${yonCls}`}>
                    {yonSign}{formatMoney(o.mebleg)}
                  </td>
                ),
                valyuta: (
                  <td key="valyuta" className="px-3 py-2.5 text-xs">{o.valyuta}</td>
                ),
                mezenne: (
                  <td key="mezenne" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {o.mezenne !== 1 ? o.mezenne.toFixed(4) : "—"}
                  </td>
                ),
                azn_mebleg: (
                  <td key="azn_mebleg" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {formatMoney(o.azn_mebleg)}
                  </td>
                ),
                komissiya: (
                  <td key="komissiya" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {o.komissiya > 0 ? formatMoney(o.komissiya) : "—"}
                  </td>
                ),
                sened: (
                  <td key="sened" className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {o.satis_id && o.satis_nomre ? (
                      <Link
                        href={`/ticaret/satislar/${o.satis_id}`}
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:bg-primary/10 hover:text-primary"
                        title="Satış sənədi"
                      >
                        <Receipt className="h-3 w-3" />
                        <span>{o.satis_nomre}</span>
                      </Link>
                    ) : o.alish_id && o.alish_nomre ? (
                      <Link
                        href={`/ticaret/alislar/${o.alish_id}`}
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:bg-primary/10 hover:text-primary"
                        title="Alış sənədi"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        <span>{o.alish_nomre}</span>
                      </Link>
                    ) : o.servis_id ? (
                      <Link
                        href={`/servis/${o.servis_id}`}
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:bg-primary/10 hover:text-primary"
                        title="Servis qeydi"
                      >
                        <Wrench className="h-3 w-3" />
                        <span>{o.sened_nomresi ?? "Servis"}</span>
                      </Link>
                    ) : o.sened_nomresi ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span>{o.sened_nomresi}</span>
                        <CopyButton value={o.sened_nomresi} title="Kopya" size="xs" />
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                ),
                status: (
                  <td key="status" className="px-3 py-2.5">
                    <SaleStatusBadge value={o.status} />
                  </td>
                ),
                qeyd: (
                  <td key="qeyd" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {o.qeyd ? <span className="line-clamp-2 max-w-xs" title={o.qeyd}>{o.qeyd}</span> : "—"}
                  </td>
                ),
                yaradan: (
                  <td key="yaradan" className="px-3 py-2.5 text-xs text-muted-foreground">{o.yaradan_ad ?? "—"}</td>
                ),
                yaradildi: (
                  <td key="yaradildi" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {o.yaradildi ? formatDate(o.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                actions: (
                  <td key="actions" className="px-3 py-2.5 text-right no-underline [text-decoration:none]">
                    <div className="inline-flex items-center gap-1.5 no-underline [text-decoration:none]">
                      <RowIconGroup>
                        <RowIconButton
                          as="a"
                          tone="print"
                          title="Print (qəbz)"
                          href={`/maliyye/emeliyyat/${o.id}/print?auto=1`}
                          target="_blank"
                          rel="noopener"
                        >
                          <PrinterIcon className="h-4 w-4" />
                        </RowIconButton>
                      </RowIconGroup>
                      <OperationRowActions op={o} canApprove={canApprove} canCancel={canCancel} />
                    </div>
                  </td>
                ),
              };
              const isCancelled = o.status === "legv" || o.status === "redd";
              return (
                <tr
                  key={o.id}
                  className={`border-b border-border/30 transition hover:bg-secondary/40 ${
                    isCancelled
                      ? "bg-destructive/[0.04] text-muted-foreground line-through decoration-destructive/40"
                      : ""
                  }`}
                >
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
