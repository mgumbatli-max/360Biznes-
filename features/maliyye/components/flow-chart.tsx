"use client";

import dynamic from "next/dynamic";
import type { MonthlyFlow } from "../queries";

const FlowChartImpl = dynamic(
  () => import("./flow-chart.impl").then((m) => m.FlowChart),
  { ssr: false, loading: () => <div className="h-[260px] w-full animate-pulse rounded-lg bg-muted/30" /> }
);

export function FlowChart(props: { data: MonthlyFlow[] }) {
  return <FlowChartImpl {...props} />;
}
