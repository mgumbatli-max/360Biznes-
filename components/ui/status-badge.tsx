import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, Info, Circle, Clock, Loader2 } from "lucide-react";

/**
 * Standartlaşdırılmış 5-rəngli status sistemi.
 *
 *  success  → əməliyyat tamamlandı, OK
 *  warning  → diqqət lazım (vaxtı yaxınlaşır, az qalır)
 *  danger   → kritik (vaxtı keçib, mənfi, dayanıb)
 *  info     → məlumat (yoldadır, gözləyir, baxılır)
 *  neutral  → neytral (draft, hələ başlamayıb, ləğv)
 *
 * `dot` görünüşü kompakt cədvəllər üçün, `pill` daha qabarıq.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export type StatusBadgeProps = {
  tone: StatusTone;
  children: React.ReactNode;
  size?: "sm" | "md";
  variant?: "pill" | "dot" | "soft";
  icon?: "auto" | "none" | React.ReactNode;
  className?: string;
  title?: string;
};

const TONE_CLASSES: Record<StatusTone, { pill: string; soft: string; dot: string; icon: React.ComponentType<{ className?: string }> }> = {
  success: {
    pill: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
    soft: "bg-emerald-500/5  text-emerald-600 border-emerald-500/15 dark:text-emerald-400",
    dot:  "bg-emerald-500",
    icon: CheckCircle2,
  },
  warning: {
    pill: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
    soft: "bg-amber-500/5  text-amber-600 border-amber-500/15 dark:text-amber-400",
    dot:  "bg-amber-500",
    icon: AlertTriangle,
  },
  danger: {
    pill: "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400",
    soft: "bg-rose-500/5  text-rose-600 border-rose-500/15 dark:text-rose-400",
    dot:  "bg-rose-500",
    icon: XCircle,
  },
  info: {
    pill: "bg-sky-500/10 text-sky-600 border-sky-500/30 dark:text-sky-400",
    soft: "bg-sky-500/5  text-sky-600 border-sky-500/15 dark:text-sky-400",
    dot:  "bg-sky-500",
    icon: Info,
  },
  neutral: {
    pill: "bg-secondary text-muted-foreground border-border",
    soft: "bg-transparent text-muted-foreground border-border/60",
    dot:  "bg-muted-foreground/50",
    icon: Circle,
  },
};

export function StatusBadge({
  tone,
  children,
  size = "sm",
  variant = "pill",
  icon = "auto",
  className,
  title,
}: StatusBadgeProps) {
  const t = TONE_CLASSES[tone];
  const sizeCls = size === "sm" ? "text-[10.5px] px-2 py-0.5" : "text-xs px-2.5 py-1";

  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)} title={title}>
        <span className={cn("h-2 w-2 rounded-full", t.dot)} aria-hidden />
        <span className="text-xs">{children}</span>
      </span>
    );
  }

  const IconCmp = icon === "auto" ? t.icon : null;
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border font-semibold whitespace-nowrap",
        variant === "pill" ? t.pill : t.soft,
        sizeCls,
        className,
      )}
      title={title}
    >
      {icon === "none" ? null : icon !== "auto" ? (
        icon
      ) : IconCmp ? (
        <IconCmp className="h-3 w-3" />
      ) : null}
      <span>{children}</span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Domain-specific status mapping helpers
 * Single source of truth — bütün anbar modulu burdan istifadə etsin.
 * ────────────────────────────────────────────────────────────────────────── */

/** Satınalma təklif statusu */
export function proposalStatusTone(status: string): StatusTone {
  switch (status) {
    case "draft": return "neutral";
    case "gonderildi": return "info";
    case "tesdiq": return "success";
    case "redd": return "danger";
    case "legv": return "neutral";
    default: return "neutral";
  }
}

/** Bron statusu */
export function bronStatusTone(status: string): StatusTone {
  switch (status) {
    case "aktiv": return "info";
    case "vaxti_bitdi": return "danger";
    case "satisa_cevrildi": return "success";
    case "legv": return "neutral";
    default: return "neutral";
  }
}

/** Konsiqnasiya statusu */
export function konsiqnasiyaStatusTone(status: string): StatusTone {
  switch (status) {
    case "aktiv": return "info";
    case "satildi": return "success";
    case "qaytarildi": return "neutral";
    default: return "neutral";
  }
}

/** Transfer statusu */
export function transferStatusTone(status: string): StatusTone {
  switch (status) {
    case "hazirlanir": return "neutral";
    case "yolda": return "info";
    case "qebul_olundu": return "success";
    case "legv": return "neutral";
    default: return "neutral";
  }
}

/** Sayım statusu */
export function inventarStatusTone(status: string): StatusTone {
  switch (status) {
    case "davam_edir": return "info";
    case "tamamlandi": return "success";
    case "legv": return "neutral";
    default: return "neutral";
  }
}

/** Stok səviyyəsi → ton (qaliq, min_stok) */
export function stockLevelTone(qaliq: number, minStok: number | null): StatusTone {
  if (qaliq <= 0) return "danger";
  if (minStok != null && qaliq < minStok) return "warning";
  return "success";
}

export { CheckCircle2, AlertTriangle, XCircle, Info, Circle, Clock, Loader2 };
