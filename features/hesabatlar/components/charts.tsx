"use client";

import dynamic from "next/dynamic";

const skel = (h = 260) => () =>
  <div className="w-full animate-pulse rounded-lg bg-muted/30" style={{ height: h }} />;

export { PALETTE } from "./charts.impl";

export const DailyLineChart = dynamic(
  () => import("./charts.impl").then((m) => m.DailyLineChart),
  { ssr: false, loading: skel(260) }
);

export const PiePaymentChart = dynamic(
  () => import("./charts.impl").then((m) => m.PiePaymentChart),
  { ssr: false, loading: skel(260) }
);

export const HorizontalBarChart = dynamic(
  () => import("./charts.impl").then((m) => m.HorizontalBarChart),
  { ssr: false, loading: skel(280) }
);

export const InOutLineChart = dynamic(
  () => import("./charts.impl").then((m) => m.InOutLineChart),
  { ssr: false, loading: skel(280) }
);

export const MonthlyPlChart = dynamic(
  () => import("./charts.impl").then((m) => m.MonthlyPlChart),
  { ssr: false, loading: skel(300) }
);
