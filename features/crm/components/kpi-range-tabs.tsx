"use client";

import Link from "next/link";
import type { KpiRange } from "../kpi-queries";

const RANGES: { value: KpiRange; label: string }[] = [
  { value: "month", label: "Bu ay" },
  { value: "last_month", label: "Keçən ay" },
  { value: "90d", label: "90 gün" },
  { value: "year", label: "İl" },
];

export function KpiRangeTabs({ current }: { current: KpiRange }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-secondary/30 p-0.5">
      {RANGES.map((r) => (
        <Link
          key={r.value}
          href={`/crm/kpi?range=${r.value}`}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            current === r.value ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}
