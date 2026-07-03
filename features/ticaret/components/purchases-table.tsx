"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Package, Eye, Printer, FileText, Wallet } from "lucide-react";
import { AlisRowActions } from "./alis-row-actions";
import { SaleStatusBadge } from "./sale-status-badge";
import { OperationQuickView } from "./operation-quick-view";
import { PurchaseRowPayDialog } from "./purchase-row-pay-dialog";
import { RowIconButton, RowPillButton, RowIconGroup } from "@/features/shared/row-icon-button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { formatDate, formatMoney } from "@/lib/utils";
import type { PurchaseListItem } from "../alis-queries";

type Props = {
  items: PurchaseListItem[];
  total: number;
  canReceive?: boolean;
  canCancel?: boolean;
};

const STORAGE_KEY = "ticaret-alislar-cols-v1";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  gozlemede: { label: "Gözləmədə", cls: "bg-warning/15 text-warning border-warning/30" },
  qebul_edildi: { label: "Qəbul edildi", cls: "bg-success/15 text-success border-success/30" },
  legv: { label: "Ləğv", cls: "bg-muted text-muted-foreground border-border" },
};

const COLUMN_DEFS: ColumnDef[] = [
  { key: "nomre",         label: "Nömrə", required: true },
  { key: "tarix",         label: "Tarix" },
  { key: "yaradildi_col", label: "Yaradılma vaxtı" },
  { key: "yenilendi_col", label: "Son düzəliş" },
  { key: "techizatci",    label: "Təchizatçı" },
  { key: "telefon",       label: "Təchizatçı telefonu" },
  { key: "anbar",         label: "Anbar" },
  { key: "menecer",       label: "Məsul menecer" },
  { key: "yaradan",       label: "Yaradan" },
  { key: "qaime_col",     label: "Qaimə №" },
  { key: "satir",         label: "Sətir sayı" },
  { key: "status_col",    label: "Status" },
  { key: "umumi",         label: "Məbləğ" },
  { key: "odenilmis",     label: "Ödənilmiş" },
  { key: "qaliq",         label: "Qalıq borc" },
  { key: "elave_xerc",    label: "Əlavə xərc" },
  { key: "kanal",         label: "Alış kanalı" },
  { key: "qeyd_col",      label: "Qeyd" },
  { key: "xerc_qeyd",     label: "Xərc qeydi" },
  { key: "filial",        label: "Filial" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  nomre: true,
  tarix: true,
  yaradildi_col: false,
  yenilendi_col: false,
  techizatci: true,
  telefon: false,
  anbar: true,
  menecer: false,
  yaradan: false,
  qaime_col: false,
  satir: true,
  status_col: true,
  umumi: true,
  odenilmis: false,
  qaliq: false,
  elave_xerc: false,
  kanal: false,
  qeyd_col: false,
  xerc_qeyd: false,
  filial: false,
};

type SortKey =
  | "tarix" | "nomre" | "techizatci" | "anbar" | "status"
  | "cemi" | "satir_say" | "yaradildi";

export function PurchasesTable({ items, total, canReceive = false, canCancel = false }: Props) {
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

  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [payRow, setPayRow] = useState<{ purchaseId: string; nomre: string } | null>(null);

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
        case "nomre": return cmpStr(a.nomre, b.nomre);
        case "techizatci": return cmpStr(a.techizatci_ad, b.techizatci_ad);
        case "anbar": return cmpStr(a.anbar_ad, b.anbar_ad);
        case "status": return cmpStr(a.status, b.status);
        case "cemi": return cmpNum(a.umumi_mebleg, b.umumi_mebleg);
        case "satir_say": return cmpNum(a.satir_say, b.satir_say);
        case "yaradildi": return cmpDate(a.yaradildi, b.yaradildi);
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Alışlar <span className="ml-2 text-xs font-normal text-muted-foreground">{total} nəticə</span>
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
                  case "nomre":         return <SortableTh key={key} label="Nömrə" current={sortBy} sortKey="nomre" dir={sortDir} onClick={setSort} />;
                  case "tarix":         return <SortableTh key={key} label="Tarix" current={sortBy} sortKey="tarix" dir={sortDir} onClick={setSort} />;
                  case "yaradildi_col": return <SortableTh key={key} label="Yaradıldı" current={sortBy} sortKey="yaradildi" dir={sortDir} onClick={setSort} />;
                  case "yenilendi_col": return <th key={key} className="px-3 py-2.5">Son düzəliş</th>;
                  case "techizatci":    return <SortableTh key={key} label="Təchizatçı" current={sortBy} sortKey="techizatci" dir={sortDir} onClick={setSort} />;
                  case "telefon":       return <th key={key} className="px-3 py-2.5">Telefon</th>;
                  case "anbar":         return <SortableTh key={key} label="Anbar" current={sortBy} sortKey="anbar" dir={sortDir} onClick={setSort} />;
                  case "menecer":       return <th key={key} className="px-3 py-2.5">Menecer</th>;
                  case "yaradan":       return <th key={key} className="px-3 py-2.5">Yaradan</th>;
                  case "qaime_col":     return <th key={key} className="px-3 py-2.5">Qaimə №</th>;
                  case "satir":         return <SortableTh key={key} label="Sətir" current={sortBy} sortKey="satir_say" dir={sortDir} onClick={setSort} align="center" />;
                  case "status_col":    return <SortableTh key={key} label="Status" current={sortBy} sortKey="status" dir={sortDir} onClick={setSort} />;
                  case "umumi":         return <SortableTh key={key} label="Məbləğ" current={sortBy} sortKey="cemi" dir={sortDir} onClick={setSort} align="right" />;
                  case "odenilmis":     return <th key={key} className="px-3 py-2.5 text-right">Ödənilmiş</th>;
                  case "qaliq":         return <th key={key} className="px-3 py-2.5 text-right">Qalıq</th>;
                  case "elave_xerc":    return <th key={key} className="px-3 py-2.5 text-right">Əlavə xərc</th>;
                  case "kanal":         return <th key={key} className="px-3 py-2.5">Kanal</th>;
                  case "qeyd_col":      return <th key={key} className="px-3 py-2.5">Qeyd</th>;
                  case "xerc_qeyd":     return <th key={key} className="px-3 py-2.5">Xərc qeydi</th>;
                  case "filial":        return <th key={key} className="px-3 py-2.5">Filial</th>;
                  default: return null;
                }
              })}
              <th className="px-3 py-2.5 text-right w-12"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const s = STATUS_LABELS[p.status] ?? STATUS_LABELS.gozlemede;
              const qaliq = p.umumi_mebleg - p.odenilmis;
              const cells: Record<string, React.ReactNode> = {
                nomre: (
                  <td key="nomre" className="px-3 py-2.5">
                    <Link href={`/ticaret/alislar/${p.id}`} className="font-mono text-xs font-medium hover:text-primary">
                      {p.nomre}
                    </Link>
                  </td>
                ),
                tarix: (
                  <td key="tarix" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {formatDate(p.tarix)}
                  </td>
                ),
                yaradildi_col: (
                  <td key="yaradildi_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p.yaradildi ? formatDate(p.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                yenilendi_col: (
                  <td key="yenilendi_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p.yenilendi ? formatDate(p.yenilendi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                techizatci: (
                  <td key="techizatci" className="px-3 py-2.5">
                    <div>{p.techizatci_ad ?? <span className="text-muted-foreground">—</span>}</div>
                    {/* Cərgədə məhsul xülasəsi — daxil olmadan görünür */}
                    {p.ilk_mehsullar.length > 0 && (
                      <div
                        className="mt-0.5 line-clamp-1 text-[10.5px] text-muted-foreground"
                        title={p.ilk_mehsullar.map((m) => `${m.ad} ×${m.miqdar}`).join(", ")}
                      >
                        {p.ilk_mehsullar.slice(0, 2).map((m, i) => (
                          <span key={i}>
                            {i > 0 && " · "}
                            <span>{m.ad}</span>
                            <span className="text-muted-foreground/70"> ×{m.miqdar}</span>
                          </span>
                        ))}
                        {p.satir_say > 2 && (
                          <span className="text-muted-foreground/70"> +{p.satir_say - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
                ),
                telefon: (
                  <td key="telefon" className="px-3 py-2.5 text-xs text-muted-foreground">{p.techizatci_telefon ?? "—"}</td>
                ),
                anbar: (
                  <td key="anbar" className="px-3 py-2.5 text-xs text-muted-foreground">
                    <Package className="inline h-3 w-3" /> {p.anbar_ad ?? "—"}
                  </td>
                ),
                menecer: (
                  <td key="menecer" className="px-3 py-2.5 text-xs text-muted-foreground">{p.menecer_ad ?? "—"}</td>
                ),
                yaradan: (
                  <td key="yaradan" className="px-3 py-2.5 text-xs text-muted-foreground">{p.yaradan_ad ?? "—"}</td>
                ),
                qaime_col: (
                  <td key="qaime_col" className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {p.qaime_nomre ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span>{p.qaime_nomre}</span>
                        <CopyButton value={p.qaime_nomre} title="Qaimə kopya et" size="xs" />
                      </span>
                    ) : "—"}
                  </td>
                ),
                satir: (
                  <td key="satir" className="px-3 py-2.5 text-center tabular-nums text-xs">{p.satir_say}</td>
                ),
                status_col: (
                  <td key="status_col" className="px-3 py-2.5">
                    <SaleStatusBadge value={p.status ?? "gozlemede"} />
                  </td>
                ),
                umumi: (
                  <td key="umumi" className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    {formatMoney(p.umumi_mebleg)}
                  </td>
                ),
                odenilmis: (
                  <td key="odenilmis" className="px-3 py-2.5 text-right tabular-nums text-xs text-success">
                    {p.odenilmis > 0 ? formatMoney(p.odenilmis) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                qaliq: (
                  <td key="qaliq" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {qaliq > 0 ? <span className="text-warning font-medium">{formatMoney(qaliq)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                elave_xerc: (
                  <td key="elave_xerc" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {p.elave_xerc > 0 ? formatMoney(p.elave_xerc) : "—"}
                  </td>
                ),
                kanal: (
                  <td key="kanal" className="px-3 py-2.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">manual</Badge>
                  </td>
                ),
                qeyd_col: (
                  <td key="qeyd_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p.qeyd ? <span className="line-clamp-2 max-w-xs" title={p.qeyd}>{p.qeyd}</span> : "—"}
                  </td>
                ),
                xerc_qeyd: (
                  <td key="xerc_qeyd" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p.xerc_qeyd ? <span className="line-clamp-2 max-w-xs" title={p.xerc_qeyd}>{p.xerc_qeyd}</span> : "—"}
                  </td>
                ),
                filial: (
                  <td key="filial" className="px-3 py-2.5 text-xs">{p.filial_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
              };
              const isCancelled = p.status === "legv";
              return (
                <Fragment key={p.id}>
                  <tr
                    className={`border-b border-border/30 transition hover:bg-secondary/40 ${
                      isCancelled
                        ? "bg-destructive/[0.04] text-muted-foreground line-through decoration-destructive/40"
                        : ""
                    }`}
                  >
                    {cols.order.map((k) => (cols.isVisible(k) ? cells[k] : null))}
                    <td className="px-3 py-2.5 text-right no-underline [text-decoration:none]">
                      <div className="inline-flex items-center gap-1.5 no-underline [text-decoration:none]">
                        <RowIconGroup>
                          <RowIconButton
                            tone="view"
                            title="Sürətli baxış (modal)"
                            onClick={() => setQuickViewId(p.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </RowIconButton>
                          <RowIconButton
                            as="a"
                            tone="doc"
                            title="Qaiməyə bax"
                            href={`/ticaret/alislar/${p.id}`}
                          >
                            <FileText className="h-4 w-4" />
                          </RowIconButton>
                          <RowIconButton
                            as="a"
                            tone="print"
                            title="Print (faktura)"
                            href={`/ticaret/alislar/${p.id}/print?auto=1`}
                            target="_blank"
                            rel="noopener"
                          >
                            <Printer className="h-4 w-4" />
                          </RowIconButton>
                        </RowIconGroup>
                        {(() => {
                          const qaliq = Math.max(0, p.umumi_mebleg - p.odenilmis);
                          return (
                            !isCancelled &&
                            qaliq > 0 && (
                              <RowPillButton
                                tone="pay-out"
                                title={`Təchizatçıya ödəniş et (${qaliq.toFixed(0)} ₼)`}
                                onClick={() => setPayRow({ purchaseId: p.id, nomre: p.nomre })}
                              >
                                <Wallet className="h-3 w-3" />
                                Ödə
                              </RowPillButton>
                            )
                          );
                        })()}
                        <AlisRowActions
                          purchaseId={p.id}
                          nomre={p.nomre}
                          status={p.status ?? null}
                          canReceive={canReceive}
                          canCancel={canCancel}
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

      {quickViewId && (
        <OperationQuickView
          open={true}
          onOpenChange={(v) => !v && setQuickViewId(null)}
          nov="alis"
          id={quickViewId}
          printHref={`/ticaret/alislar/${quickViewId}/print?auto=1`}
          detailHref={`/ticaret/alislar/${quickViewId}`}
        />
      )}
      {payRow && (
        <PurchaseRowPayDialog
          open={true}
          onOpenChange={(v) => !v && setPayRow(null)}
          purchaseId={payRow.purchaseId}
          nomre={payRow.nomre}
        />
      )}
    </div>
  );
}

