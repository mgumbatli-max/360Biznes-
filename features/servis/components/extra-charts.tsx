"use client";

import dynamic from "next/dynamic";

const skel = (h = 260) => () =>
  <div className="w-full animate-pulse rounded-lg bg-muted/30" style={{ height: h }} />;

export const CycleTimeChart = dynamic(
  () => import("./extra-charts.impl").then((m) => m.CycleTimeChart),
  { ssr: false, loading: skel(260) }
);

export const BottleneckChart = dynamic(
  () => import("./extra-charts.impl").then((m) => m.BottleneckChart),
  { ssr: false, loading: skel(260) }
);

export const CostRevenueChart = dynamic(
  () => import("./extra-charts.impl").then((m) => m.CostRevenueChart),
  { ssr: false, loading: skel(260) }
);

export const DefektPieChart = dynamic(
  () => import("./extra-charts.impl").then((m) => m.DefektPieChart),
  { ssr: false, loading: skel(260) }
);

export const SourceSplitChart = dynamic(
  () => import("./extra-charts.impl").then((m) => m.SourceSplitChart),
  { ssr: false, loading: skel(180) }
);

export const DailyServisChart = dynamic(
  () => import("./extra-charts.impl").then((m) => m.DailyServisChart),
  { ssr: false, loading: skel(260) }
);

export const HourlyHeatmap = dynamic(
  () => import("./extra-charts.impl").then((m) => m.HourlyHeatmap),
  { ssr: false, loading: skel(280) }
);
