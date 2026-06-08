"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Eye, ChevronDown, ChevronRight, ExternalLink, Undo2 } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/utils";
import { CustomerDrawer } from "@/features/elaqe/components/customer-drawer";
import { AcceptReturnButton } from "./accept-return-button";
import { CancelReturnButton } from "./cancel-return-button";
import { SaleStatusBadge } from "@/features/ticaret/components/sale-status-badge";
import { RowIconButton, RowIconGroup } from "@/features/shared/row-icon-button";
import type { ReturnRow } from "../queries";

const STATUS: Record<string, { label: string; cls: string }> = {
  tesdiqlenmemis: { label: "Gözləyir", cls: "bg-warning/15 text-warning border-warning/30" },
  tesdiqlendi: { label: "Təsdiqləndi", cls: "bg-info/15 text-info border-info/30" },
  tamamlandi: { label: "Tamamlandı", cls: "bg-success/15 text-success border-success/30" },
  legv: { label: "Ləğv", cls: "bg-muted text-muted-foreground border-border" },
};

const NOV: Record<string, string> = {
  satis_qaytarma: "Müştəri qaytarması",
  alis_qaytarma: "Təchizatçıya qaytarma",
};

export function ReturnsTable({ rows }: { rows: ReturnRow[] }) {
  const [openPeeks, setOpenPeeks] = useState<Set<string>>(new Set());
  function togglePeek(id: string) {
    setOpenPeeks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <Undo2 className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <h3 className="font-semibold">Filtrə uyğun qaytarma yoxdur</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Yuxarıdakı <strong>Yeni qaytarma</strong> düyməsi ilə qaytarma yaradın və ya filtrləri sıfırlayın.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5">Nömrə / Tarix</th>
            <th className="px-3 py-2.5">Növ</th>
            <th className="px-3 py-2.5">Kontragent / Məhsul</th>
            <th className="px-3 py-2.5">Anbar</th>
            <th className="px-3 py-2.5">Səbəb</th>
            <th className="px-3 py-2.5 text-center">Sətr</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5 text-right">Məbləğ</th>
            <th className="px-3 py-2.5 text-right" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = STATUS[r.status] ?? STATUS.tesdiqlenmemis;
            const isOpen = openPeeks.has(r.id);
            const isCancelled = r.status === "legv";
            return (
              <Fragment key={r.id}>
                <tr
                  className={`border-b border-border/30 transition hover:bg-secondary/40 ${
                    isCancelled
                      ? "bg-destructive/[0.04] text-muted-foreground line-through decoration-destructive/40"
                      : ""
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-xs font-medium">{r.nomre}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(r.tarix)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{NOV[r.nov] ?? r.nov}</td>
                  <td className="px-3 py-2.5">
                    {r.kontragent_id && r.kontragent_ad ? (
                      <CustomerDrawer customerId={r.kontragent_id}>
                        <button
                          type="button"
                          className="text-left text-sm transition hover:text-primary hover:underline"
                        >
                          {r.kontragent_ad}
                        </button>
                      </CustomerDrawer>
                    ) : (
                      <span className="text-sm">{r.kontragent_ad ?? "—"}</span>
                    )}
                    {/* Cərgədə məhsul xülasəsi — daxil olmadan görünür */}
                    {r.ilk_mehsullar.length > 0 && (
                      <div
                        className="mt-0.5 line-clamp-1 text-[10.5px] text-muted-foreground"
                        title={r.ilk_mehsullar.map((m) => `${m.ad} ×${m.miqdar}`).join(", ")}
                      >
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
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.anbar_ad ?? "—"}</td>
                  <td
                    className="max-w-[200px] truncate px-3 py-2.5 text-xs text-muted-foreground"
                    title={r.sebeb ?? undefined}
                  >
                    {r.sebeb ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-xs">{r.satir_say}</td>
                  <td className="px-3 py-2.5">
                    <SaleStatusBadge value={r.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    {formatMoney(r.umumi_mebleg)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {r.ilk_mehsullar.length > 0 && (
                        <RowIconGroup>
                          <RowIconButton
                            tone={isOpen ? "primary" : "view"}
                            title={isOpen ? "Bağla" : "Tez baxış"}
                            onClick={() => togglePeek(r.id)}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </RowIconButton>
                        </RowIconGroup>
                      )}
                      {r.status === "tesdiqlenmemis" && (
                        <>
                          <AcceptReturnButton id={r.id} nomre={r.nomre} />
                          <CancelReturnButton id={r.id} nomre={r.nomre} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {isOpen && r.ilk_mehsullar.length > 0 && (
                  <tr className="border-b border-border/30 bg-secondary/30">
                    <td colSpan={9} className="px-3 py-3">
                      <ReturnPeekContent ret={r} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReturnPeekContent({ ret }: { ret: ReturnRow }) {
  const totalLines = ret.ilk_mehsullar.reduce((s, l) => s + l.cemi, 0);
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">
          {ret.nomre} — Qaytarılan məhsullar
        </span>
        <Link
          href={`/ticaret/qaytarma#${ret.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground"
        >
          Tam detay
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      {ret.sebeb && (
        <div className="mb-2 rounded-md border border-border/40 bg-secondary/40 px-2 py-1.5 text-[11px] text-muted-foreground">
          <strong>Səbəb:</strong> {ret.sebeb}
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="pb-1 text-left">Məhsul</th>
            <th className="pb-1 text-right w-20">Miqdar</th>
            <th className="pb-1 text-right w-24">Qiymət</th>
            <th className="pb-1 text-right w-24">Cəmi</th>
          </tr>
        </thead>
        <tbody>
          {ret.ilk_mehsullar.map((line, idx) => (
            <tr key={idx} className="border-t border-border/30">
              <td className="py-1.5">
                <div className="font-medium">{line.ad}</div>
                {line.kod && (
                  <div className="font-mono text-[10px] text-muted-foreground">{line.kod}</div>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">{line.miqdar}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                {formatMoney(line.qiymet)}
              </td>
              <td className="py-1.5 text-right tabular-nums font-medium">
                {formatMoney(line.cemi)}
              </td>
            </tr>
          ))}
          {ret.satir_say > ret.ilk_mehsullar.length && (
            <tr>
              <td colSpan={4} className="pt-2 text-center text-[10.5px] italic text-muted-foreground">
                + {ret.satir_say - ret.ilk_mehsullar.length} əlavə sətr — tam detay üçün açın
              </td>
            </tr>
          )}
          <tr className="border-t-2 border-border/60">
            <td colSpan={3} className="pt-1.5 text-right text-[10.5px] uppercase tracking-wider text-muted-foreground">
              Cəm qaytarma
            </td>
            <td className="pt-1.5 text-right tabular-nums font-bold">
              {formatMoney(totalLines || ret.umumi_mebleg)}
            </td>
          </tr>
          {ret.geri_qaytarildi > 0 && (
            <tr>
              <td colSpan={3} className="text-right text-[10.5px] text-muted-foreground">
                Geri qaytarılan
              </td>
              <td className="text-right tabular-nums text-emerald-600">
                {formatMoney(ret.geri_qaytarildi)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
