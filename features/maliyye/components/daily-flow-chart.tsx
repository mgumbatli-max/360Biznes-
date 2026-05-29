"use client";

import dynamic from "next/dynamic";

type Row = { gun: string; daxil: number; xaric: number };

const DailyFlowChartImpl = dynamic(
  () => import("./daily-flow-chart.impl").then((m) => m.DailyFlowChart),
  { ssr: false, loading: () => <div className="h-[280px] w-full animate-pulse rounded-lg bg-muted/30" /> }
);

export function DailyFlowChart(props: { data: Row[] }) {
  return <DailyFlowChartImpl {...props} />;
}
