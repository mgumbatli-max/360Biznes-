"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import type { MonthlyFlow } from "../queries";
import { formatMoney } from "@/lib/utils";

export function FlowChart({ data }: { data: MonthlyFlow[] }) {
  const isEmpty = data.every((d) => d.daxil === 0 && d.xaric === 0);

  if (isEmpty) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <span className="text-3xl">📊</span>
        <p className="font-medium text-foreground">Hələ maliyyə hərəkəti yoxdur</p>
        <p className="text-xs">Satış və xərclər qeydə alındıqda qrafik buraya gələcək.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="month" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke="hsl(218 18% 68%)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="mb-1 font-semibold">{label}</div>
                {payload.map((p) => (
                  <div key={p.dataKey as string} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-muted-foreground">{p.dataKey === "daxil" ? "Daxil" : "Xaric"}:</span>
                    <span className="font-medium text-foreground">{formatMoney(p.value as number)}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => (v === "daxil" ? "Daxil" : "Xaric")} />
        <Bar dataKey="daxil" fill="hsl(160 60% 52%)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="xaric" fill="hsl(0 91% 71%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
