"use client";

import dynamic from "next/dynamic";
import type { AnalitikaData } from "../analitika-queries";

const AnalitikaPanelImpl = dynamic(
  () => import("./analitika-panel.impl").then((m) => m.AnalitikaPanel),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="h-[280px] w-full animate-pulse rounded-lg bg-muted/30" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-[240px] animate-pulse rounded-lg bg-muted/30 lg:col-span-2" />
          <div className="h-[240px] animate-pulse rounded-lg bg-muted/30" />
        </div>
      </div>
    ),
  }
);

export function AnalitikaPanel(props: {
  data: AnalitikaData;
  insight: { text: string; is_mock: boolean };
}) {
  return <AnalitikaPanelImpl {...props} />;
}
