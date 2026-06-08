"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ExternalLink, Calendar, User, Package,
  Wallet, FileText, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";
import { getJourneyItemDetail, type JourneyItemDetail } from "../timeline-peek-action";
import { formatMoney, formatDate } from "@/lib/utils";

type Kind = "sale" | "payment_in" | "payment_out" | "return" | "servis";

const KIND_LABEL: Record<Kind, string> = {
  sale: "Satış sənədi",
  payment_in: "Ödəniş daxil",
  payment_out: "Ödəniş çıxış",
  return: "Qaytarma",
  servis: "Servis qeydi",
};

const KIND_TONE: Record<Kind, string> = {
  sale: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  payment_in: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  payment_out: "border-rose-500/40 bg-rose-500/10 text-rose-700",
  return: "border-sky-500/40 bg-sky-500/10 text-sky-700",
  servis: "border-violet-500/40 bg-violet-500/10 text-violet-700",
};

export function TimelinePeekButton({
  kind,
  refId,
  fullPageHref,
  label = "Bax",
  className,
}: {
  kind: Kind;
  refId: string;
  fullPageHref?: string | null;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<JourneyItemDetail | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (detail && detail.ref_id === refId) return;
    startTransition(async () => {
      const d = await getJourneyItemDetail(kind, refId);
      setDetail(d);
    });
  }, [open, kind, refId, detail]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] hover:bg-secondary"
        }
      >
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline" className={`text-[10px] ${KIND_TONE[kind]}`}>
                {KIND_LABEL[kind]}
              </Badge>
              <span className="truncate">{detail?.title ?? (pending ? "Yüklənir..." : "")}</span>
            </DialogTitle>
            {detail?.subtitle && <DialogDescription className="text-xs">{detail.subtitle}</DialogDescription>}
          </DialogHeader>

          {pending && !detail && (
            <div className="grid place-items-center py-14">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {detail && (
            <div className="mt-4 space-y-3 text-sm">
              {/* Əsas məbləğ bloku */}
              {detail.amount != null && (
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Məbləğ</div>
                  <div className={`mt-0.5 text-2xl font-bold tabular-nums ${detail.amount_tone === "danger" ? "text-rose-600" : detail.amount_tone === "success" ? "text-emerald-600" : ""}`}>
                    {formatMoney(detail.amount)}
                  </div>
                  {detail.balance_info && (
                    <div className="mt-1 text-[11px] text-muted-foreground">{detail.balance_info}</div>
                  )}
                </div>
              )}

              {/* Sahə-sahə detallar */}
              <div className="space-y-1.5">
                {detail.fields.map((f, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 border-b border-border/30 pb-1.5 text-xs last:border-0">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {f.icon === "calendar" && <Calendar className="h-3 w-3" />}
                      {f.icon === "user" && <User className="h-3 w-3" />}
                      {f.icon === "package" && <Package className="h-3 w-3" />}
                      {f.icon === "wallet" && <Wallet className="h-3 w-3" />}
                      {f.icon === "file" && <FileText className="h-3 w-3" />}
                      {f.icon === "in" && <ArrowDownToLine className="h-3 w-3" />}
                      {f.icon === "out" && <ArrowUpFromLine className="h-3 w-3" />}
                      {f.label}
                    </div>
                    <div className="text-right font-medium tabular-nums">{f.value}</div>
                  </div>
                ))}
              </div>

              {/* Məhsul siyahısı (satış üçün) */}
              {detail.lines && detail.lines.length > 0 && (
                <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
                  <div className="border-b border-border/40 bg-secondary/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Məhsullar ({detail.lines.length})
                  </div>
                  <table className="w-full text-xs">
                    <thead className="border-b border-border/30 text-left text-[10px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5">Məhsul</th>
                        <th className="px-2 py-1.5 text-right">Miqdar</th>
                        <th className="px-2 py-1.5 text-right">Qiymət</th>
                        <th className="px-2 py-1.5 text-right">Cəmi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l, i) => (
                        <tr key={i} className="border-b border-border/20 last:border-0">
                          <td className="px-2 py-1.5">{l.mehsul_ad}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{l.miqdar}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(l.qiymet)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{formatMoney(l.cemi)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Allocations (ödəniş üçün — hansı qaimələrə bağlandı) */}
              {detail.allocations && detail.allocations.length > 0 && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 p-2 space-y-1">
                  <div className="text-[10.5px] uppercase tracking-wider text-emerald-700 font-semibold">
                    Bağlandığı qaimələr ({detail.allocations.length})
                  </div>
                  {detail.allocations.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <Link
                        href={a.href ?? "#"}
                        className="font-mono font-medium text-emerald-700 hover:underline"
                      >
                        {a.nomre}
                      </Link>
                      <span className="font-semibold tabular-nums text-emerald-700">
                        {formatMoney(a.mebleg)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Əlavə qeyd */}
              {detail.qeyd && (
                <div className="rounded-lg border border-border bg-secondary/30 p-2 text-[11px] italic text-muted-foreground">
                  {detail.qeyd}
                </div>
              )}
            </div>
          )}

          {/* Footer — "Tam səhifə" və "Bağla" */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Bağla
            </Button>
            {fullPageHref && (
              <Link
                href={fullPageHref}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Tam səhifədə aç
              </Link>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
