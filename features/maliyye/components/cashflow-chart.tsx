"use client";

import dynamic from "next/dynamic";
import type { CashflowRow } from "../cashflow-queries";

const CashflowChartImpl = dynamic(
  () => import("./cashflow-chart.impl").then((m) => m.CashflowChart),
  { ssr: false, loading: () => <div className="h-[280px] w-full animate-pulse rounded-lg bg-muted/30" /> }
);

export function CashflowChart(props: { data: CashflowRow[] }) {
  return <CashflowChartImpl {...props} />;
}
