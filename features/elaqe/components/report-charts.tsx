"use client";

import dynamic from "next/dynamic";

const skel = (h = 240) => () =>
  <div className="w-full animate-pulse rounded-lg bg-muted/30" style={{ height: h }} />;

export const MonthlyNewChart = dynamic(
  () => import("./report-charts.impl").then((m) => m.MonthlyNewChart),
  { ssr: false, loading: skel(240) }
);

export const DebtBucketsChart = dynamic(
  () => import("./report-charts.impl").then((m) => m.DebtBucketsChart),
  { ssr: false, loading: skel(240) }
);

export const StatusPieChart = dynamic(
  () => import("./report-charts.impl").then((m) => m.StatusPieChart),
  { ssr: false, loading: skel(220) }
);
