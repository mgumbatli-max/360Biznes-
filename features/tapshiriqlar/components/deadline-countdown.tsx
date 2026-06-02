"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  deadline: Date | string | null;
  completed?: boolean;
  /** Compact rejim — yalnız vacib məlumat (badge formatında) */
  compact?: boolean;
};

/**
 * Deadline-a qalan vaxtı canlı göstərən badge.
 * - Tamamlandı: yaşıl "Tamamlandı"
 * - 24 saatdan az qalıb: amber pulsing
 * - Keçib: rose dramatic ("X saat gecikib")
 * - 24 saatdan çox: neutral "X gün qalıb"
 * Hər 60 saniyədən bir öz-özünə yenilənir (real-time hiss).
 */
export function DeadlineCountdown({ deadline, completed, compact }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (completed || !deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [completed, deadline]);

  if (!deadline) return null;

  if (completed) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      )}>
        <CheckCircle2 className="h-2.5 w-2.5" />
        {compact ? "Bitdi" : "Tamamlandı"}
      </span>
    );
  }

  const dl = typeof deadline === "string" ? new Date(deadline) : deadline;
  const diff = dl.getTime() - now;
  const absMins = Math.abs(Math.floor(diff / 60_000));
  const days = Math.floor(absMins / 1440);
  const hours = Math.floor((absMins % 1440) / 60);
  const mins = absMins % 60;

  function formatRel(): string {
    if (days > 0) return `${days} gün ${hours > 0 ? `${hours} saat` : ""}`.trim();
    if (hours > 0) return `${hours} saat ${mins > 0 ? `${mins} dəq` : ""}`.trim();
    return `${mins} dəq`;
  }

  if (diff < 0) {
    // Gecikib
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold animate-pulse",
        "border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400",
      )}>
        <AlertTriangle className="h-2.5 w-2.5" />
        {compact ? `−${formatRel()}` : `${formatRel()} gecikib`}
      </span>
    );
  }

  // Aktiv — qalan vaxt
  const urgent = diff < 24 * 60 * 60 * 1000;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
      urgent
        ? "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse"
        : "border-border bg-secondary/40 text-muted-foreground",
    )}>
      <Clock className="h-2.5 w-2.5" />
      {compact ? formatRel() : `${formatRel()} qalıb`}
    </span>
  );
}
