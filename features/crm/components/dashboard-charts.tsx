"use client";

import dynamic from "next/dynamic";

const skel = (h = 260) => () =>
  <div className="w-full animate-pulse rounded-lg bg-muted/30" style={{ height: h }} />;

export const DailyChart = dynamic(
  () => import("./dashboard-charts.impl").then((m) => m.DailyChart),
  { ssr: false, loading: skel(260) }
);

export const SourcesChart = dynamic(
  () => import("./dashboard-charts.impl").then((m) => m.SourcesChart),
  { ssr: false, loading: skel(260) }
);

export const FunnelChart = dynamic(
  () => import("./dashboard-charts.impl").then((m) => m.FunnelChart),
  { ssr: false, loading: skel(260) }
);

export const SourceAnalyticsChart = dynamic(
  () => import("./dashboard-charts.impl").then((m) => m.SourceAnalyticsChart),
  { ssr: false, loading: skel(260) }
);
