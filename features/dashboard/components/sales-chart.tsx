"use client";

import dynamic from "next/dynamic";
import type { DailySalesPoint } from "../queries";

type Props = { data: DailySalesPoint[] };

const SalesChartImpl = dynamic(() => import("./sales-chart.impl"), {
  ssr: false,
  loading: () => <div className="h-[240px] w-full animate-pulse rounded-lg bg-muted/30" />,
});

export function SalesChart(props: Props) {
  return <SalesChartImpl {...props} />;
}
