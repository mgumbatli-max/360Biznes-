"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TopProductRow } from "../queries";

type Props = { data: TopProductRow[] };

const COLORS = [
  "hsl(239 84% 67%)",
  "hsl(262 83% 67%)",
  "hsl(330 81% 60%)",
  "hsl(199 89% 48%)",
  "hsl(154 64% 50%)",
];

export function TopProductsChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
        Bu ay üçün satış məlumatı yoxdur.
      </div>
    );
  }

  const display = data.map((d) => ({ ...d, ad: d.ad.length > 22 ? d.ad.slice(0, 21) + "…" : d.ad }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={display} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <XAxis type="number" stroke="hsl(218 18% 68%)" fontSize={10} tickLine={false} axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))} />
        <YAxis type="category" dataKey="ad" stroke="hsl(218 18% 68%)" fontSize={10}
          tickLine={false} axisLine={false} width={110} />
        <Tooltip
          cursor={{ fill: "hsl(228 32% 22% / 0.4)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const it = payload[0].payload as TopProductRow;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{it.ad}</div>
                <div className="mt-0.5 text-muted-foreground">
                  Məbləğ: <span className="font-medium text-foreground">{it.mebleg.toLocaleString("az-AZ")} ₼</span>
                </div>
                <div className="text-muted-foreground">
                  Miqdar: <span className="font-medium text-foreground">{it.miqdar}</span>
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="mebleg" radius={[0, 6, 6, 0]}>
          {display.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
