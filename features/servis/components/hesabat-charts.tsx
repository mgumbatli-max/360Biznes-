"use client";

import dynamic from "next/dynamic";

const skel = (h = 260) => () =>
  <div className="w-full animate-pulse rounded-lg bg-muted/30" style={{ height: h }} />;

export const TechPerfChart = dynamic(
  () => import("./hesabat-charts.impl").then((m) => m.TechPerfChart),
  { ssr: false, loading: skel(260) }
);

export const TopFailChart = dynamic(
  () => import("./hesabat-charts.impl").then((m) => m.TopFailChart),
  { ssr: false, loading: skel(260) }
);

export const TrendChart = dynamic(
  () => import("./hesabat-charts.impl").then((m) => m.TrendChart),
  { ssr: false, loading: skel(260) }
);
