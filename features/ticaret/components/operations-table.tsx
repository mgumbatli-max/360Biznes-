"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Activity, ShoppingCart, Truck, Undo2, ArrowLeftRight, Eye, Printer, Wallet, FileText } from "lucide-react";
import { OperationRowActions } from "./operation-row-actions";
import { OperationQuickView } from "./operation-quick-view";
import { SaleRowPayDialog } from "./sale-row-pay-dialog";
import { PurchaseRowPayDialog } from "./purchase-row-pay-dialog";
import { RowIconButton, RowPillButton, RowIconGroup } from "@/features/shared/row-icon-button";
import { Badge } from "@/components/ui/badge";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { PaymentBadge, SaleStatusBadge } from "./sale-status-badge";
import { formatDate, formatMoney } from "@/lib/utils";
import type { OperationRow } from "../emeliyyat-queries";

type Props = {
  items: OperationRow[];
  total: number;
  canPaySale?: boolean;
  canCancelSale?: boolean;
  canReceivePurchase?: boolean;
  canCancelPurchase?: boolean;
};

// v3 — sol tərəfdə "Tez əməllər" sütunu Prospect-ə bənzər
const STORAGE_KEY = "ticaret-emeliyyat-cols-v3";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "quick",     label: "Tez", required: true },
  { key: "tarix",     label: "Tarix", required: true },
  { key: "nov",       label: "Növ" },
  { key: "nomre",     label: "Sənəd №" },
  { key: "kontragent",label: "Kontragent" },
  { key: "anbar",     label: "Anbar" },
  { key: "satir",     label: "Sətir" },
  { key: "status",    label: "Status" },
  { key: "odenis",    label: "Ödəniş növü" },
  { key: "meb",       label: "Məbləğ" },
  { key: "odenilmis", label: "Ödənilmiş" },
  { key: "qaliq",     label: "Qalıq" },
  { key: "yaradan",   label: "Yaradan" },
  { key: "yaradildi", label: "Yaradılma" },
  { key: "qeyd",      label: "Qeyd" },
  { key: "kanal",     label: "Kanal" },
  { key: "id_col",    label: "ID" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  quick: true,
  tarix: true,
  nov: true,
  nomre: true,
  kontragent: true,
  anbar: true,
  satir: true,
  status: true,
  odenis: true,
  meb: true,
  odenilmis: false,
  qaliq: true,
  yaradan: false,
  yaradildi: false,
  qeyd: false,
  kanal: false,
  id_col: false,
};

const NOV_BADGE: Record<string, { label: string; cls: string; Icon: typeof ShoppingCart }> = {
  satis:    { label: "Satış",     cls: "bg-success/15 text-success border-success/30",  Icon: ShoppingCart },
  alis:     { label: "Alış",      cls: "bg-info/15 text-info border-info/30",            Icon: Truck },
  qaytarma: { label: "Qaytarma",  cls: "bg-warning/15 text-warning border-warning/30",   Icon: Undo2 },
  transfer: { label: "Transfer",  cls: "bg-primary/15 text-primary-light border-primary/30", Icon: ArrowLeftRight },
};

type SortKey = "tarix" | "nomre" | "kontragent" | "status" | "meb" | "qaliq" | "satir" | "yaradildi";

export function OperationsTable({
  items,
  total,
  canPaySale = false,
  canCancelSale = false,
  canReceivePurchase = false,
  canCancelPurchase = false,
}: Props) {
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

  /** Quick-view modal vəziyyəti — Eye düyməsi ilə açılır */
  const [quickViewRow, setQuickViewRow] = useState<{ nov: "satis" | "alis"; id: string; printHref: string | null; detailHref: string } | null>(null);
  /** Quick-pay dialog (satış) — Wallet düyməsi ilə açılır */
  const [payRow, setPayRow] = useState<{ saleId: string; nomre: string; qaliq: number } | null>(null);
  /** Quick-pay dialog (alış — təchizatçıya ödəniş) */
  const [payAlisRow, setPayAlisRow] = useState<{ purchaseId: string; nomre: string } | null>(null);

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
    const cs = (a: string | null, b: string | null) => (a ?? "").localeCompare(b ?? "", "az") * mult;
    const cn = (a: number, b: number) => (a - b) * mult;
    const cd = (a: Date | null, b: Date | null) =>
      ((a ? a.getTime() : 0) - (b ? b.getTime() : 0)) * mult;
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case "tarix": return cd(a.tarix, b.tarix);
        case "nomre": return cs(a.nomre, b.nomre);
        case "kontragent": return cs(a.kontragent_ad, b.kontragent_ad);
        case "status": return cs(a.status, b.status);
        case "meb": return cn(a.meb, b.meb);
        case "qaliq": return cn(a.qaliq, b.qaliq);
        case "satir": return cn(a.satir_say, b.satir_say);
        case "yaradildi": return cd(a.yaradildi, b.yaradildi);
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">Əməliyyat tapılmadı</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">Filteri yumşaldın və ya tarix aralığını genişləndirin.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Əməliyyatlar <span className="ml-2 text-xs font-normal text-muted-foreground">{total} nəticə</span>
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
                  case "quick": return <th key={key} className="px-2 py-2.5 text-center w-24">Tez</th>;
                  case "tarix": return <SortableTh key={key} label="Tarix" current={sortBy} sortKey="tarix" dir={sortDir} onClick={setSort} />;
                  case "nov":   return <th key={key} className="px-3 py-2.5">Növ</th>;
                  case "nomre": return <SortableTh key={key} label="Sənəd №" current={sortBy} sortKey="nomre" dir={sortDir} onClick={setSort} />;
                  case "kontragent": return <SortableTh key={key} label="Kontragent" current={sortBy} sortKey="kontragent" dir={sortDir} onClick={setSort} />;
                  case "anbar": return <th key={key} className="px-3 py-2.5">Anbar</th>;
                  case "satir": return <SortableTh key={key} label="Sətir" current={sortBy} sortKey="satir" dir={sortDir} onClick={setSort} align="center" />;
                  case "status": return <SortableTh key={key} label="Status" current={sortBy} sortKey="status" dir={sortDir} onClick={setSort} />;
                  case "odenis": return <th key={key} className="px-3 py-2.5">Ödəniş</th>;
                  case "meb": return <SortableTh key={key} label="Məbləğ" current={sortBy} sortKey="meb" dir={sortDir} onClick={setSort} align="right" />;
                  case "odenilmis": return <th key={key} className="px-3 py-2.5 text-right">Ödənilmiş</th>;
                  case "qaliq": return <SortableTh key={key} label="Qalıq" current={sortBy} sortKey="qaliq" dir={sortDir} onClick={setSort} align="right" />;
                  case "yaradan": return <th key={key} className="px-3 py-2.5">Yaradan</th>;
                  case "yaradildi": return <SortableTh key={key} label="Yaradılma" current={sortBy} sortKey="yaradildi" dir={sortDir} onClick={setSort} />;
                  case "qeyd": return <th key={key} className="px-3 py-2.5">Qeyd</th>;
                  case "kanal": return <th key={key} className="px-3 py-2.5">Kanal</th>;
                  case "id_col": return <th key={key} className="px-3 py-2.5">ID</th>;
                  default: return null;
                }
              })}
              <th className="px-3 py-2.5 text-right w-12"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const nb = NOV_BADGE[r.nov] ?? NOV_BADGE.satis;
              const cells: Record<string, React.ReactNode> = {
                quick: (
                  <td key="quick" className="px-2 py-1.5 no-underline [text-decoration:none]">
                    <RowIconGroup>
                      <RowIconButton
                        tone="view"
                        title="Sürətli baxış (modal)"
                        onClick={() =>
                          setQuickViewRow({
                            nov: (r.nov === "satis" || r.nov === "alis" ? r.nov : "satis") as "satis" | "alis",
                            id: r.id,
                            printHref:
                              r.nov === "satis"
                                ? `/ticaret/satislar/${r.id}/print?auto=1`
                                : r.nov === "alis"
                                  ? `/ticaret/alislar/${r.id}/print?auto=1`
                                  : null,
                            detailHref: r.href,
                          })
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </RowIconButton>
                      <RowIconButton as="a" tone="doc" title="Qaiməyə bax" href={r.href}>
                        <FileText className="h-4 w-4" />
                      </RowIconButton>
                      {(r.nov === "satis" || r.nov === "alis") && (
                        <RowIconButton
                          as="a"
                          tone="print"
                          title="Print (faktura)"
                          href={
                            r.nov === "satis"
                              ? `/ticaret/satislar/${r.id}/print?auto=1`
                              : `/ticaret/alislar/${r.id}/print?auto=1`
                          }
                          target="_blank"
                          rel="noopener"
                        >
                          <Printer className="h-4 w-4" />
                        </RowIconButton>
                      )}
                    </RowIconGroup>
                  </td>
                ),
                tarix: (
                  <td key="tarix" className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(r.tarix)}</td>
                ),
                nov: (
                  <td key="nov" className="px-3 py-2.5">
                    <Badge variant="outline" className={`gap-1 ${nb.cls} text-[10px]`}>
                      <nb.Icon className="h-3 w-3" />
                      {nb.label}
                    </Badge>
                  </td>
                ),
                nomre: (
                  <td key="nomre" className="px-3 py-2.5">
                    <Link href={r.href} className="font-mono text-xs font-medium hover:text-primary">
                      {r.nomre}
                    </Link>
                  </td>
                ),
                kontragent: (
                  <td key="kontragent" className="px-3 py-2.5 text-sm">
                    <div className="font-medium">
                      {r.kontragent_ad ?? <span className="text-muted-foreground">—</span>}
                    </div>
                    {/* Cərgədə məhsul xülasəsi — daxil olmadan görünməsi üçün */}
                    {r.ilk_mehsullar.length > 0 && (
                      <div className="mt-0.5 line-clamp-1 text-[10.5px] text-muted-foreground" title={r.ilk_mehsullar.map((m) => `${m.ad} ×${m.miqdar}`).join(", ")}>
                        {r.ilk_mehsullar.slice(0, 2).map((m, i) => (
                          <span key={i}>
                            {i > 0 && " · "}
                            <span>{m.ad}</span>
                            <span className="text-muted-foreground/70"> ×{m.miqdar}</span>
                          </span>
                        ))}
                        {r.satir_say > 2 && (
                          <span className="text-muted-foreground/70"> +{r.satir_say - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
                ),
                anbar: (
                  <td key="anbar" className="px-3 py-2.5 text-xs">{r.anbar_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                satir: (
                  <td key="satir" className="px-3 py-2.5 text-center tabular-nums text-xs">{r.satir_say}</td>
                ),
                status: (
                  <td key="status" className="px-3 py-2.5">
                    <SaleStatusBadge value={r.status} />
                  </td>
                ),
                odenis: (
                  <td key="odenis" className="px-3 py-2.5">
                    {r.odenis_nov ? (
                      <PaymentBadge value={r.odenis_nov} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                meb: (
                  <td key="meb" className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    {r.meb > 0 ? formatMoney(r.meb) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                odenilmis: (
                  <td key="odenilmis" className="px-3 py-2.5 text-right tabular-nums text-xs text-success">
                    {r.odenilmis > 0 ? formatMoney(r.odenilmis) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                qaliq: (
                  <td key="qaliq" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {r.qaliq > 0 ? <span className="text-warning font-medium">{formatMoney(r.qaliq)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                yaradan: (
                  <td key="yaradan" className="px-3 py-2.5 text-xs text-muted-foreground">{r.yaradan_ad ?? "—"}</td>
                ),
                yaradildi: (
                  <td key="yaradildi" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.yaradildi ? formatDate(r.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                qeyd: (
                  <td key="qeyd" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.qeyd ? <span className="line-clamp-2 max-w-xs" title={r.qeyd}>{r.qeyd}</span> : "—"}
                  </td>
                ),
                kanal: (
                  <td key="kanal" className="px-3 py-2.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">{r.nov}</Badge>
                  </td>
                ),
                id_col: (
                  <td key="id_col" className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
                    {r.id.slice(0, 8)}…
                  </td>
                ),
              };
              const isCancelled = r.status === "legv";
              return (
                <Fragment key={`${r.nov}-${r.id}`}>
                  <tr
                    className={`border-b border-border/30 transition hover:bg-secondary/40 ${
                      isCancelled
                        ? "bg-destructive/[0.04] text-muted-foreground line-through decoration-destructive/40"
                        : ""
                    }`}
                  >
                    {cols.order.map((k) => (cols.isVisible(k) ? cells[k] : null))}
                    <td className="px-3 py-2.5 text-right no-underline [text-decoration:none]">
                      <div className="inline-flex items-center gap-0.5 no-underline [text-decoration:none]">
                        {r.nov === "satis" && canPaySale && r.qaliq > 0 && !isCancelled && (
                          <RowPillButton
                            tone="pay-in"
                            title={`Müştəridən ödəniş qəbul et (${r.qaliq.toFixed(0)} ₼)`}
                            onClick={() =>
                              setPayRow({ saleId: r.id, nomre: r.nomre, qaliq: r.qaliq })
                            }
                          >
                            <Wallet className="h-3 w-3" />
                            Ödə
                          </RowPillButton>
                        )}
                        {r.nov === "alis" && r.qaliq > 0 && !isCancelled && (
                          <RowPillButton
                            tone="pay-out"
                            title={`Təchizatçıya ödəniş et (${r.qaliq.toFixed(0)} ₼)`}
                            onClick={() => setPayAlisRow({ purchaseId: r.id, nomre: r.nomre })}
                          >
                            <Wallet className="h-3 w-3" />
                            Ödə
                          </RowPillButton>
                        )}
                        <OperationRowActions
                          row={r}
                          canPaySale={canPaySale}
                          canCancelSale={canCancelSale}
                          canReceivePurchase={canReceivePurchase}
                          canCancelPurchase={canCancelPurchase}
                        />
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick view modal — Eye düyməsi ilə açılır, tablarla zəngin baxış */}
      {quickViewRow && (
        <OperationQuickView
          open={true}
          onOpenChange={(v) => !v && setQuickViewRow(null)}
          nov={quickViewRow.nov}
          id={quickViewRow.id}
          printHref={quickViewRow.printHref}
          detailHref={quickViewRow.detailHref}
        />
      )}

      {/* Quick-pay dialog (satış) — Wallet düyməsi ilə açılır */}
      {payRow && (
        <SaleRowPayDialog
          open={true}
          onOpenChange={(v) => !v && setPayRow(null)}
          saleId={payRow.saleId}
          nomre={payRow.nomre}
          qaliq={payRow.qaliq}
        />
      )}
      {/* Quick-pay dialog (alış) — təchizatçıya ödəniş */}
      {payAlisRow && (
        <PurchaseRowPayDialog
          open={true}
          onOpenChange={(v) => !v && setPayAlisRow(null)}
          purchaseId={payAlisRow.purchaseId}
          nomre={payAlisRow.nomre}
        />
      )}
    </div>
  );
}

