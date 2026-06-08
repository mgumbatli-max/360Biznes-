"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User, AlertTriangle, ShoppingBag, Wallet, Calendar,
  TrendingDown, FileText, ExternalLink,
} from "lucide-react";
import { getContactContext, type ContactContext } from "../contact-context-action";
import { formatMoney, formatDate } from "@/lib/utils";

const RISK_TONE: Record<"low" | "medium" | "high", string> = {
  low: "border-emerald-500/40 bg-emerald-50 text-emerald-700",
  medium: "border-amber-500/40 bg-amber-50 text-amber-700",
  high: "border-rose-500/40 bg-rose-50 text-rose-700",
};

/**
 * Universal kontekst paneli — istifadəçi kontragent seçəndə dərhal
 * onun cari vəziyyətini göstərir: borc, açıq qaimə, son ödəniş,
 * son alış/satış, risk göstəricisi.
 *
 * Yeni Satış, Yeni Alış, Ödəniş və Borc bağlama dialoglarında istifadə oluna bilər.
 */
export function ContactContextPanel({
  kontragentId,
  side,
  detailHref,
  compact = false,
}: {
  kontragentId: string;
  /** "customer" — müştəri rolu (satış/ödəniş), "supplier" — təchizatçı (alış) */
  side: "customer" | "supplier";
  /** "Detallı bax" linki */
  detailHref?: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<ContactContext | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!kontragentId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getContactContext(kontragentId)
      .then((c) => { if (!cancelled) setData(c); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kontragentId]);

  if (!kontragentId) return null;
  if (loading && !data) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-2 text-center text-[11px] text-muted-foreground">
        Kontekst yüklənir...
      </div>
    );
  }
  if (!data) return null;

  const link = detailHref ?? `/elaqe/${side === "supplier" ? "techizatcilar" : "musteriler"}/${data.id}`;
  const acigSay = side === "supplier" ? data.acig_alis_say : data.acig_satis_say;
  const sonSened = side === "supplier" ? data.son_alis : data.son_satis;
  const sonSenedLabel = side === "supplier" ? "Son alış" : "Son satış";

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card/40 p-2 text-[10.5px]">
        <Badge tone={data.borc > 0 ? "danger" : "neutral"}>
          Borc: <strong>{formatMoney(data.borc)}</strong>
        </Badge>
        {data.avans > 0 && (
          <Badge tone="violet">Avans: <strong>{formatMoney(data.avans)}</strong></Badge>
        )}
        <Badge tone="muted">Açıq: <strong>{acigSay}</strong></Badge>
        {data.son_odenis && (
          <Badge tone="success">
            Son ödəniş: <strong>{formatMoney(data.son_odenis.mebleg)}</strong>
          </Badge>
        )}
        <span className={`ml-auto rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${RISK_TONE[data.risk]}`}>
          {data.risk_label}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">{data.ad}</div>
            <div className="text-[10px] text-muted-foreground">
              {data.is_customer && data.is_supplier ? "Müştəri + Təchizatçı" : data.is_customer ? "Müştəri" : "Təchizatçı"}
            </div>
          </div>
        </div>
        <Link
          href={link}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] hover:bg-secondary"
        >
          Detallı <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>

      {/* Əsas göstəricilər */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Stat
          icon={Wallet}
          label="Cari borc"
          value={formatMoney(data.borc)}
          tone={data.borc > 0 ? "danger" : "success"}
        />
        <Stat
          icon={FileText}
          label="Açıq sənəd"
          value={String(acigSay)}
          tone={acigSay > 0 ? "warning" : "neutral"}
        />
        <Stat
          icon={TrendingDown}
          label="Avans"
          value={data.avans > 0 ? formatMoney(data.avans) : "—"}
          tone={data.avans > 0 ? "violet" : "neutral"}
        />
        <Stat
          icon={AlertTriangle}
          label="Limit"
          value={
            data.borc_limiti != null
              ? `${formatMoney(data.borc_limiti)}${data.limit_asib ? " (aşıb)" : ""}`
              : "limitsiz"
          }
          tone={data.limit_asib ? "danger" : "neutral"}
        />
      </div>

      {/* Son hadisələr */}
      <div className="grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2">
        {sonSened && (
          <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ShoppingBag className="h-3 w-3" />
              <span>{sonSenedLabel}:</span>
              <span className="font-mono font-medium text-foreground">{sonSened.nomre}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="tabular-nums font-semibold">{formatMoney(sonSened.mebleg)}</span>
              <span className="text-muted-foreground text-[10px]">
                <Calendar className="inline h-2.5 w-2.5 mr-0.5" />
                {formatDate(sonSened.tarix)}
              </span>
            </div>
          </div>
        )}
        {data.son_odenis && (
          <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50/60 px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <Wallet className="h-3 w-3" />
              <span>Son ödəniş:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="tabular-nums font-semibold text-emerald-700">+{formatMoney(data.son_odenis.mebleg)}</span>
              <span className="text-emerald-600 text-[10px]">
                <Calendar className="inline h-2.5 w-2.5 mr-0.5" />
                {formatDate(data.son_odenis.tarix)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Risk badge */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${RISK_TONE[data.risk]}`}>
          {data.risk === "high" && <AlertTriangle className="h-2.5 w-2.5" />}
          {data.risk_label}
        </span>
        {data.limit_asib && (
          <span className="text-[10.5px] text-rose-600 font-medium">
            ⚠️ Nisyə satış üçün icazə tələb olunur
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger" | "warning" | "violet";
}) {
  const cls =
    tone === "success" ? "text-emerald-700" :
    tone === "danger" ? "text-rose-700" :
    tone === "warning" ? "text-amber-700" :
    tone === "violet" ? "text-violet-700" :
    "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "danger" | "success" | "warning" | "violet" | "neutral" | "muted";
  children: React.ReactNode;
}) {
  const cls = {
    danger:  "border-rose-300 bg-rose-50 text-rose-700",
    success: "border-emerald-300 bg-emerald-50 text-emerald-700",
    warning: "border-amber-300 bg-amber-50 text-amber-700",
    violet:  "border-violet-300 bg-violet-50 text-violet-700",
    neutral: "border-border bg-background text-foreground",
    muted:   "border-border bg-secondary text-muted-foreground",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 ${cls}`}>
      {children}
    </span>
  );
}
