"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  Phone,
  Mail,
  MessageCircle,
  User,
  FileText,
  Loader2,
  TrendingUp,
  Calendar,
  CreditCard,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/utils";
import { NisyePaymentQuick } from "./nisye-payment-quick";
import { loadCustomerOpenInvoices } from "../debt-detail-actions";
import type { OpenSaleOpt } from "../queries";

type DebtorRow = {
  id: string;
  ad: string;
  telefon: string | null;
  whatsapp: string | null;
  email: string | null;
  voen: string | null;
  menecer_ad: string | null;
  borc: number;
  borc_limiti: number | null;
  limit_asib: boolean;
  avans: number;
  son_satis_nomre: string | null;
  son_satis_mebleg: number | null;
  son_alver: Date | null;
  son_odenis_tarix: Date | null;
  son_odenis_mebleg: number | null;
  acig_sened_say: number;
  gun_kecdi: number;
};

type HesabOpt = { id: string; ad: string; nov: string };

type Props = {
  row: DebtorRow;
  hesablar: HesabOpt[];
  /** İlkin pre-fetched data (top-N müştərilər üçün) */
  initialOpenSales?: OpenSaleOpt[];
};

export function DebtorRowExpanded({ row, hesablar, initialOpenSales }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [invoices, setInvoices] = useState<OpenSaleOpt[] | null>(
    initialOpenSales ?? null,
  );
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!expanded && invoices === null) {
      startTransition(async () => {
        const res = await loadCustomerOpenInvoices(row.id);
        if (res.ok) setInvoices(res.data);
        else setInvoices([]);
      });
    }
    setExpanded((v) => !v);
  }

  const tone =
    row.gun_kecdi > 60
      ? "border-l-rose-500"
      : row.gun_kecdi > 30
        ? "border-l-amber-500"
        : "border-l-emerald-500";
  const waNumber = row.whatsapp ?? row.telefon ?? "";
  const waDigits = waNumber.replace(/[^0-9]/g, "");
  const waText = encodeURIComponent(
    `Salam, ${row.ad}! ${row.borc.toFixed(2)} ₼ borcunuz aşağıdakı qaimələrə görə qalıb. Ödəniş üçün rahatlığla əlaqə saxlaya bilərsiniz.`,
  );

  return (
    <>
      {/* SUMMARY ROW */}
      <tr
        className={`group cursor-pointer border-l-4 ${tone} border-b border-border/30 transition-colors hover:bg-secondary/30`}
        onClick={toggle}
      >
        <td className="px-3 py-3 align-top">
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary"
            title={expanded ? "Yığ" : "Aç"}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </td>
        <td className="px-3 py-3 align-top">
          <div className="font-semibold text-foreground">{row.ad}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {row.voen && <span>VÖEN: {row.voen}</span>}
            {row.menecer_ad && <span>· {row.menecer_ad}</span>}
            {row.borc_limiti != null && (
              <span>
                · Limit {formatMoney(row.borc_limiti)}
                {row.limit_asib && (
                  <Badge variant="outline" className="ml-1 border-rose-400/40 bg-rose-500/10 px-1 py-0 text-[9px] text-rose-600">
                    aşıb
                  </Badge>
                )}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 align-top text-xs">
          {row.telefon ? (
            <a
              href={`tel:${row.telefon}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <Phone className="h-3 w-3" /> {row.telefon}
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {row.email && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Mail className="h-3 w-3" /> {row.email}
            </div>
          )}
        </td>
        <td className="px-3 py-3 align-top text-right">
          <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatMoney(row.borc)}
          </div>
          {row.avans > 0 && (
            <div className="mt-0.5 text-[10px] text-violet-600">
              Avans: {formatMoney(row.avans)}
            </div>
          )}
        </td>
        <td className="px-3 py-3 align-top text-center">
          <div className="inline-flex h-7 w-9 items-center justify-center rounded-md bg-secondary text-sm font-bold tabular-nums">
            {row.acig_sened_say}
          </div>
        </td>
        <td className="px-3 py-3 align-top text-right">
          <div
            className={`tabular-nums text-sm font-semibold ${
              row.gun_kecdi > 60
                ? "text-rose-600"
                : row.gun_kecdi > 30
                  ? "text-amber-600"
                  : "text-muted-foreground"
            }`}
          >
            {row.son_alver ? `${row.gun_kecdi} gün` : "—"}
          </div>
          {row.son_odenis_tarix && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              Son: {formatDate(row.son_odenis_tarix)}
            </div>
          )}
        </td>
        <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <NisyePaymentQuick
              musteriId={row.id}
              ad={row.ad}
              borc={row.borc}
              hesablar={hesablar}
              openSales={invoices ?? []}
              variant="icon"
            />
            {waDigits && (
              <a
                href={`https://wa.me/${waDigits}?text=${waText}`}
                target="_blank"
                rel="noopener"
                title="WhatsApp xatırlatma"
                className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-secondary"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            )}
            <Link
              href={`/elaqe/musteriler/${row.id}`}
              title="Müştəri profili"
              className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-secondary"
            >
              <User className="h-3.5 w-3.5" />
            </Link>
          </div>
        </td>
      </tr>

      {/* EXPANDED PANEL */}
      {expanded && (
        <tr className="border-b border-border/40 bg-muted/30">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
              {/* OPEN INVOICES LIST */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Açıq qaimələr ({invoices?.length ?? "..."})
                  </h4>
                </div>
                {pending && invoices === null ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-6 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Yüklənir...
                  </div>
                ) : !invoices || invoices.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-card/40 py-4 text-center text-xs text-muted-foreground">
                    Açıq qaimə yoxdur
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {invoices.map((inv) => {
                      const odenisFaiz =
                        inv.son_mebleg > 0
                          ? (inv.odenilmis / inv.son_mebleg) * 100
                          : 0;
                      const overdue = inv.gun_kecdi > 30;
                      const critical = inv.gun_kecdi > 60;
                      return (
                        <Link
                          key={inv.id}
                          href={`/ticaret/satislar/${inv.id}`}
                          className={`group/inv block rounded-lg border bg-card p-2.5 transition-all hover:border-primary/40 hover:shadow-sm ${
                            critical
                              ? "border-rose-300/60"
                              : overdue
                                ? "border-amber-300/60"
                                : "border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-semibold text-foreground">
                                  #{inv.nomre}
                                </span>
                                {critical && (
                                  <AlertTriangle className="h-3 w-3 text-rose-500" />
                                )}
                                <Badge
                                  variant="outline"
                                  className="px-1 py-0 text-[9px] uppercase tracking-wider"
                                >
                                  {inv.odenis_nov ?? "—"}
                                </Badge>
                                {inv.satir_sayi > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {inv.satir_sayi} sətir
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(inv.tarix)}
                                </span>
                                <span
                                  className={`tabular-nums ${
                                    critical
                                      ? "font-semibold text-rose-600"
                                      : overdue
                                        ? "font-semibold text-amber-600"
                                        : ""
                                  }`}
                                >
                                  {inv.gun_kecdi} gün
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {formatMoney(inv.qalig)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                / {formatMoney(inv.son_mebleg)}
                              </div>
                              {inv.odenilmis > 0 && (
                                <div className="text-[10px] text-muted-foreground">
                                  Ödənib: {formatMoney(inv.odenilmis)}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Progress bar */}
                          {inv.son_mebleg > 0 && (
                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(100, odenisFaiz)}%` }}
                              />
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* QUICK INFO PANEL */}
              <div className="space-y-2">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Müştəri xülasəsi
                  </h4>
                </div>
                <InfoCard
                  label="Son alış-veriş"
                  value={row.son_alver ? formatDate(row.son_alver) : "—"}
                  sub={row.son_satis_nomre ? `#${row.son_satis_nomre} · ${formatMoney(row.son_satis_mebleg ?? 0)}` : null}
                />
                <InfoCard
                  label="Son ödəniş"
                  value={row.son_odenis_tarix ? formatDate(row.son_odenis_tarix) : "—"}
                  sub={row.son_odenis_mebleg != null ? `+${formatMoney(row.son_odenis_mebleg)}` : null}
                  tone="success"
                />
                {row.borc_limiti != null && (
                  <InfoCard
                    label="Kredit limiti"
                    value={formatMoney(row.borc_limiti)}
                    sub={`İstifadə: ${((row.borc / row.borc_limiti) * 100).toFixed(0)}%`}
                    tone={row.limit_asib ? "danger" : "info"}
                  />
                )}
                <Link
                  href={`/elaqe/musteriler/${row.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Tam müştəri profili
                </Link>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function InfoCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string | null;
  tone?: "neutral" | "success" | "info" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "info"
        ? "text-sky-600 dark:text-sky-400"
        : tone === "danger"
          ? "text-rose-600 dark:text-rose-400"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
