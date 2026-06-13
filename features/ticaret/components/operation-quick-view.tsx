"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Wallet, Printer, ExternalLink, History, Receipt, ListChecks, Info, Link2 } from "lucide-react";
import Link from "next/link";
import { LinkedOperationsPanel } from "@/features/emeliyyat/components/linked-operations-panel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaleStatusBadge, PaymentBadge } from "./sale-status-badge";
import { formatDate, formatMoney } from "@/lib/utils";
import {
  getOperationDetailAction,
  type OperationDetailResult,
  type OperationDetailData,
} from "../operation-detail-action";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  yeni: { label: "Yeni", cls: "border-info/30 bg-info/10 text-info" },
  tamamlandi: { label: "Tamamlandı", cls: "border-success/30 bg-success/10 text-success" },
  legv: { label: "Ləğv", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  gozlemede: { label: "Gözləmədə", cls: "border-warning/30 bg-warning/10 text-warning" },
  qebul_edildi: { label: "Qəbul edildi", cls: "border-success/30 bg-success/10 text-success" },
};

export function OperationQuickView({
  open,
  onOpenChange,
  nov,
  id,
  printHref,
  detailHref,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nov: "satis" | "alis";
  id: string;
  printHref?: string | null;
  detailHref: string;
}) {
  const [data, setData] = useState<OperationDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    if (!open) return;
    setData(null);
    setError(null);
    startLoading(async () => {
      const r: OperationDetailResult = await getOperationDetailAction(nov, id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData(r);
    });
  }, [open, nov, id]);

  const novColorBar =
    nov === "satis"
      ? "from-emerald-500/20 via-emerald-500/5 to-transparent"
      : "from-sky-500/20 via-sky-500/5 to-transparent";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0"
      >
        <SheetHeader
          className={`relative border-b border-border/50 bg-gradient-to-r ${novColorBar} px-5 py-4`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {nov === "satis" ? "Satış əməliyyatı" : "Alış əməliyyatı"}
              </div>
              <SheetTitle className="mt-0.5 flex items-center gap-2 text-base font-bold">
                {data ? (
                  <span className="font-mono text-base">{data.nomre}</span>
                ) : (
                  <span className="text-muted-foreground">Yüklənir…</span>
                )}
                {data && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {formatDate(data.tarix)}
                  </span>
                )}
              </SheetTitle>
              {data?.kontragent_ad && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {nov === "satis" ? "Müştəri" : "Təchizatçı"}: <span className="font-medium text-foreground">{data.kontragent_ad}</span>
                </div>
              )}
            </div>
            {data && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Yekun
                </div>
                <div className="text-xl font-bold tabular-nums">
                  {formatMoney(data.umumi_mebleg)}
                </div>
                {data.qaliq > 0 && (
                  <div className="text-[10.5px] font-medium text-warning">
                    Qalıq: {formatMoney(data.qaliq)}
                  </div>
                )}
              </div>
            )}
          </div>
          <SheetDescription className="sr-only">
            Əməliyyatın tam baxışı: ümumi məlumat, sətirlər, ödənişlər, audit tarixçəsi
          </SheetDescription>
          <div className="mt-3 flex items-center gap-1.5">
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link href={detailHref}>
                <ExternalLink className="h-3.5 w-3.5" />
                Tam sənəd
              </Link>
            </Button>
            {printHref && (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={printHref} target="_blank" rel="noopener">
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </Link>
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="px-5 py-4">
          {loading && (
            <div className="space-y-3 py-3">
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted/60" />
              <div className="space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted/60" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted/60" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted/60" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted/60" />
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {data && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full bg-muted/60 p-1">
                <TabsTrigger value="info" className="flex-1 gap-1.5 transition-all duration-200">
                  <Info className="h-3.5 w-3.5" />
                  Ümumi
                </TabsTrigger>
                <TabsTrigger value="lines" className="flex-1 gap-1.5 transition-all duration-200">
                  <ListChecks className="h-3.5 w-3.5" />
                  Sətirlər
                  <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[9px] tabular-nums">
                    {data.lines.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex-1 gap-1.5 transition-all duration-200">
                  <Receipt className="h-3.5 w-3.5" />
                  Ödənişlər
                  <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[9px] tabular-nums">
                    {data.payments.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="audit" className="flex-1 gap-1.5 transition-all duration-200">
                  <History className="h-3.5 w-3.5" />
                  Tarixçə
                </TabsTrigger>
                <TabsTrigger value="linked" className="flex-1 gap-1.5 transition-all duration-200">
                  <Link2 className="h-3.5 w-3.5" />
                  Bağlı əməliyyatlar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 space-y-2 text-sm">
                <InfoRow label="Status">
                  {nov === "satis" ? (
                    <SaleStatusBadge value={data.status} />
                  ) : (
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE[data.status]?.cls ?? ""}
                    >
                      {STATUS_BADGE[data.status]?.label ?? data.status}
                    </Badge>
                  )}
                </InfoRow>
                <InfoRow label="Ödəniş növü">
                  <PaymentBadge value={data.odenis_nov} />
                </InfoRow>
                <InfoRow label="Tarix">{formatDate(data.tarix)}</InfoRow>
                <InfoRow label="Qarşı tərəf">{data.kontragent_ad ?? "—"}</InfoRow>
                <InfoRow label="Anbar">{data.anbar_ad ?? "—"}</InfoRow>
                <InfoRow label="Cəmi məbləğ">
                  <span className="font-semibold tabular-nums">{formatMoney(data.umumi_mebleg)}</span>
                </InfoRow>
                <InfoRow label="Ödənilmiş">
                  <span className="tabular-nums text-success">{formatMoney(data.odenilmis)}</span>
                </InfoRow>
                <InfoRow label="Qalıq">
                  <span
                    className={`tabular-nums font-semibold ${data.qaliq > 0 ? "text-warning" : "text-muted-foreground"}`}
                  >
                    {formatMoney(data.qaliq)}
                  </span>
                </InfoRow>
                <InfoRow label="Yaradan">{data.yaradan_ad ?? "—"}</InfoRow>
                <InfoRow label="Yaradılma">
                  {data.yaradildi ? formatDate(data.yaradildi, { hour: "2-digit", minute: "2-digit" }) : "—"}
                </InfoRow>
                {data.yenilendi && (
                  <InfoRow label="Son düzəliş">
                    {formatDate(data.yenilendi, { hour: "2-digit", minute: "2-digit" })}
                  </InfoRow>
                )}
                {data.qeyd && (
                  <div className="mt-3 rounded-md border border-border/40 bg-secondary/30 p-2 text-xs">
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Qeyd
                    </div>
                    <div className="whitespace-pre-wrap">{data.qeyd}</div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lines" className="mt-4">
                {data.lines.length === 0 ? (
                  <EmptyState text="Sətir yoxdur" />
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border/40">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Məhsul</th>
                          <th className="px-2 py-1.5 text-right">Miqdar</th>
                          <th className="px-2 py-1.5 text-right">Qiymət</th>
                          {nov === "satis" && <th className="px-2 py-1.5 text-right">End.%</th>}
                          <th className="px-2 py-1.5 text-right">Cəmi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.lines.map((l, idx) => (
                          <tr key={idx} className="border-t border-border/30">
                            <td className="px-2 py-1.5">
                              <div className="font-medium">{l.ad}</div>
                              {l.kod && (
                                <div className="text-[10px] text-muted-foreground">{l.kod}</div>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{l.miqdar}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {formatMoney(l.qiymet)}
                            </td>
                            {nov === "satis" && (
                              <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                {l.endirim_faiz && l.endirim_faiz > 0 ? `${l.endirim_faiz}%` : "—"}
                              </td>
                            )}
                            <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                              {formatMoney(l.cemi)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border/60 bg-secondary/40 font-semibold">
                          <td className="px-2 py-1.5" colSpan={nov === "satis" ? 4 : 3}>
                            Cəm
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {formatMoney(data.umumi_mebleg)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                {data.payments.length === 0 ? (
                  <EmptyState text="Ödəniş yoxdur — hələ heç bir ödəniş qeyd edilməyib." />
                ) : (
                  <div className="space-y-2">
                    {data.payments.map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between rounded-md border border-border/40 bg-card/40 px-3 py-2 text-xs ${
                          p.status === "legv" ? "opacity-60 line-through" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-semibold tabular-nums">
                              {formatMoney(p.mebleg)}
                            </span>
                            <PaymentBadge value={p.odenis_nov} />
                            {p.status === "legv" && (
                              <Badge variant="outline" className="text-[9px] text-destructive">
                                Ləğv
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                            <span>{formatDate(p.tarix)}</span>
                            {p.hesab_ad && <span>· {p.hesab_ad}</span>}
                            {p.yaradan_ad && <span>· {p.yaradan_ad}</span>}
                          </div>
                          {p.qeyd && (
                            <div className="mt-0.5 line-clamp-1 text-[10.5px] text-muted-foreground/80">
                              {p.qeyd}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="mt-3 flex items-center justify-between rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-xs">
                      <span className="text-muted-foreground">Ümumi ödənilmiş</span>
                      <span className="font-bold tabular-nums text-success">
                        {formatMoney(data.odenilmis)}
                      </span>
                    </div>
                    {data.qaliq > 0 && (
                      <div className="flex items-center justify-between rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
                        <span className="text-warning">Qalıq</span>
                        <span className="font-bold tabular-nums text-warning">
                          {formatMoney(data.qaliq)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                {data.audit.length === 0 ? (
                  <EmptyState text="Audit tarixçəsi yoxdur" />
                ) : (
                  <div className="space-y-1.5">
                    {data.audit.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-2 rounded-md border border-border/40 bg-card/40 px-3 py-2 text-xs"
                      >
                        <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{a.emeliyyat}</span>
                            {a.status && a.status !== "ugur" && (
                              <Badge variant="outline" className="text-[9px]">
                                {a.status}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground">
                            {a.istifadeci_ad ?? "—"} ·{" "}
                            {a.yaradildi
                              ? formatDate(a.yaradildi, {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </div>
                          {a.sebeb && (
                            <div className="mt-1 line-clamp-2 text-[10.5px] text-muted-foreground/80">
                              {a.sebeb}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="linked" className="mt-4">
                <LinkedOperationsPanel mode="view" target={{ type: nov, id }} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/20 py-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right text-xs">{children}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-secondary/20 py-6 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
