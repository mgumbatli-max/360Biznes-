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
  Truck,
  FileText,
  Loader2,
  Calendar,
  AlertTriangle,
  Eye,
  Banknote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/utils";
import { loadSupplierOpenInvoices } from "../debt-detail-actions";
import type { OpenPurchaseOpt } from "../queries";

type CreditorRow = {
  id: string;
  ad: string;
  telefon: string | null;
  whatsapp: string | null;
  email: string | null;
  voen: string | null;
  borc: number;
  son_alver: Date | null;
  gun_kecdi: number;
  son_odenis_tarix: Date | null;
  son_odenis_mebleg: number | null;
  son_alis_nomre: string | null;
  son_alis_mebleg: number | null;
  acig_sened_say: number;
};

type Props = {
  row: CreditorRow;
};

export function CreditorRowExpanded({ row }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [invoices, setInvoices] = useState<OpenPurchaseOpt[] | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!expanded && invoices === null) {
      startTransition(async () => {
        const res = await loadSupplierOpenInvoices(row.id);
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
        : "border-l-sky-500";
  const waNumber = row.whatsapp ?? row.telefon ?? "";
  const waDigits = waNumber.replace(/[^0-9]/g, "");
  const waText = encodeURIComponent(
    `Salam, ${row.ad}! Borcumuz: ${row.borc.toFixed(2)} ₼. Ödəniş cədvəlimizi bildirmək istəyirik.`,
  );

  return (
    <>
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
          {row.voen && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">VÖEN: {row.voen}</div>
          )}
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
          <div className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {formatMoney(row.borc)}
          </div>
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
            <Link
              href={`/maliyye/kreditor?new=techizatci_odenish&kontragent=${row.id}`}
              title="Ödəniş et"
              className="grid h-7 w-7 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
            >
              <Banknote className="h-3.5 w-3.5" />
            </Link>
            {waDigits && (
              <a
                href={`https://wa.me/${waDigits}?text=${waText}`}
                target="_blank"
                rel="noopener"
                title="WhatsApp"
                className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-secondary"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            )}
            <Link
              href={`/elaqe/techizatcilar/${row.id}`}
              title="Profil"
              className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-secondary"
            >
              <User className="h-3.5 w-3.5" />
            </Link>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border/40 bg-muted/30">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Açıq alış qaimələri ({invoices?.length ?? "..."})
                  </h4>
                </div>
                {pending && invoices === null ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-6 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Yüklənir...
                  </div>
                ) : !invoices || invoices.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-card/40 py-4 text-center text-xs text-muted-foreground">
                    Açıq alış qaiməsi yoxdur
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {invoices.map((inv) => {
                      const odenisFaiz =
                        inv.umumi_mebleg > 0
                          ? (inv.odenilmis / inv.umumi_mebleg) * 100
                          : 0;
                      const overdue = inv.gun_kecdi > 30;
                      const critical = inv.gun_kecdi > 60;
                      return (
                        <Link
                          key={inv.id}
                          href={`/ticaret/alislar/${inv.id}`}
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
                                {inv.status && (
                                  <Badge
                                    variant="outline"
                                    className="px-1 py-0 text-[9px] uppercase tracking-wider"
                                  >
                                    {inv.status}
                                  </Badge>
                                )}
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
                              <div className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                                {formatMoney(inv.qalig)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                / {formatMoney(inv.umumi_mebleg)}
                              </div>
                              {inv.odenilmis > 0 && (
                                <div className="text-[10px] text-muted-foreground">
                                  Ödənib: {formatMoney(inv.odenilmis)}
                                </div>
                              )}
                            </div>
                          </div>
                          {inv.umumi_mebleg > 0 && (
                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-rose-500/60 transition-all"
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

              <div className="space-y-2">
                <div className="mb-2 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Təchizatçı xülasəsi
                  </h4>
                </div>
                <InfoCard
                  label="Son alış"
                  value={row.son_alver ? formatDate(row.son_alver) : "—"}
                  sub={
                    row.son_alis_nomre
                      ? `#${row.son_alis_nomre} · ${formatMoney(row.son_alis_mebleg ?? 0)}`
                      : null
                  }
                />
                <InfoCard
                  label="Son ödəniş"
                  value={row.son_odenis_tarix ? formatDate(row.son_odenis_tarix) : "—"}
                  sub={
                    row.son_odenis_mebleg != null
                      ? `-${formatMoney(row.son_odenis_mebleg)}`
                      : null
                  }
                  tone="info"
                />
                <Link
                  href={`/elaqe/techizatcilar/${row.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Tam təchizatçı profili
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
  tone?: "neutral" | "info";
}) {
  const toneCls =
    tone === "info" ? "text-sky-600 dark:text-sky-400" : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${toneCls}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
