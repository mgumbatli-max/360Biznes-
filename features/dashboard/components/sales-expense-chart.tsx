"use client";

import dynamic from "next/dynamic";
import type { SalesVsExpensePoint } from "../queries";

const SalesExpenseChartImpl = dynamic(
  () => import("./sales-expense-chart.impl").then((m) => m.SalesExpenseChart),
  { ssr: false, loading: () => <div className="h-[240px] w-full animate-pulse rounded-lg bg-muted/30" /> }
);

export function SalesExpenseChart(props: { data: SalesVsExpensePoint[] }) {
  return <SalesExpenseChartImpl {...props} />;
}
