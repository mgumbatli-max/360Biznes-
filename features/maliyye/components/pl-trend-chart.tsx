"use client";

import dynamic from "next/dynamic";

type Row = { ay: string; gelir: number; xerc: number; menfeet: number };

const PLTrendChartImpl = dynamic(
  () => import("./pl-trend-chart.impl").then((m) => m.PLTrendChart),
  { ssr: false, loading: () => <div className="h-[280px] w-full animate-pulse rounded-lg bg-muted/30" /> }
);

export function PLTrendChart(props: { data: Row[] }) {
  return <PLTrendChartImpl {...props} />;
}
