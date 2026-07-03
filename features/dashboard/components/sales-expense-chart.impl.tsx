"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { formatDate, formatMoney } from "@/lib/utils";
import type { SalesVsExpensePoint } from "../queries";

type Props = { data: SalesVsExpensePoint[] };

export function SalesExpenseChart({ data }: Props) {
  const display = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: formatDate(d.gun, { day: "numeric", month: "short" }),
      })),
    [data]
  );

  const isEmpty = display.every((d) => d.satis === 0 && d.xerc === 0);
  if (isEmpty) {
    return (
      <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
        Bu ay üçün satış və ya xərc məlumatı yoxdur.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={display} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="label" stroke="hsl(218 18% 68%)" fontSize={10} tickLine={false} axisLine={false} interval={4} />
        <YAxis stroke="hsl(218 18% 68%)" fontSize={10} tickLine={false} axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))} />
        <Tooltip
          cursor={{ fill: "hsl(228 32% 22% / 0.4)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{label}</div>
                {payload.map((p) => (
                  <div key={p.dataKey as string} className="text-muted-foreground">
                    <span className="capitalize">{p.dataKey === "satis" ? "Satış" : "Xərc"}:</span>{" "}
                    <span className="font-medium text-foreground">
                      {formatMoney(Number(p.value))}
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Bar dataKey="satis" name="Satış" fill="hsl(154 64% 50%)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="xerc" name="Xərc" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
