"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

type Stats = {
  cemi: number;
  gozleyir: number;
  icrada: number;
  yoxlanilir: number;
  tamamlandi: number;
  gecikmis: number;
};

type Kpi = {
  label: string;
  value: number;
  status: string | null; // null = "all" reset
  tone: string;
  border: string;
};

export function TaskKpiStrip({ stats }: { stats: Stats }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const activeStatus = sp.get("status") ?? "";
  const activeOverdue = sp.get("overdue") === "1";

  const items: Kpi[] = [
    { label: "Cəmi", value: stats.cemi, status: null, tone: "text-slate-700 dark:text-slate-200", border: "border-slate-300/60" },
    { label: "Gözləyir", value: stats.gozleyir, status: "yeni", tone: "text-amber-700 dark:text-amber-300", border: "border-amber-300/60" },
    { label: "İcradadır", value: stats.icrada, status: "icrada", tone: "text-sky-700 dark:text-sky-300", border: "border-sky-300/60" },
    { label: "Yoxlanılır", value: stats.yoxlanilir, status: "gozlemede", tone: "text-violet-700 dark:text-violet-300", border: "border-violet-300/60" },
    { label: "Tamamlandı", value: stats.tamamlandi, status: "tamamlandi", tone: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300/60" },
    { label: "Gecikən", value: stats.gecikmis, status: "__overdue__", tone: "text-rose-700 dark:text-rose-300", border: "border-rose-300/60" },
  ];

  function go(k: Kpi) {
    const p = new URLSearchParams(sp.toString());
    p.delete("status");
    p.delete("overdue");
    if (k.status === "__overdue__") {
      p.set("overdue", "1");
    } else if (k.status) {
      p.set("status", k.status);
    }
    startTransition(() => router.push(`/tapshiriqlar?${p.toString()}`));
  }

  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
      {items.map((k) => {
        const isActive =
          (k.status === "__overdue__" && activeOverdue) ||
          (k.status && k.status === activeStatus) ||
          (k.status === null && !activeStatus && !activeOverdue);
        return (
          <button
            key={k.label}
            type="button"
            onClick={() => go(k)}
            disabled={pending}
            className={cn(
              "rounded-xl border bg-card/60 p-3 text-left transition hover:shadow-sm",
              k.border,
              isActive && "ring-2 ring-primary shadow"
            )}
          >
            <div className={cn("text-2xl font-bold leading-none", k.tone)}>{k.value}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {k.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
