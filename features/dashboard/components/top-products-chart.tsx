"use client";

import dynamic from "next/dynamic";
import type { TopProductRow } from "../queries";

const TopProductsChartImpl = dynamic(
  () => import("./top-products-chart.impl").then((m) => m.TopProductsChart),
  { ssr: false, loading: () => <div className="h-[240px] w-full animate-pulse rounded-lg bg-muted/30" /> }
);

export function TopProductsChart(props: { data: TopProductRow[] }) {
  return <TopProductsChartImpl {...props} />;
}
