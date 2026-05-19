"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils";
import type { CashflowRow } from "../cashflow-queries";

export function CashflowChart({ data }: { data: CashflowRow[] }) {
  const isEmpty = data.every((d) => d.daxil === 0 && d.xaric === 0);
  if (isEmpty) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <span className="text-3xl">💸</span>
        <p className="font-medium text-foreground">Hələ pul axını verisi yoxdur</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="daxilFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(160 60% 52%)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="hsl(160 60% 52%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="xaricFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(0 91% 71%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(0 91% 71%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis
          dataKey="bucket"
          stroke="hsl(218 18% 68%)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          minTickGap={20}
        />
        <YAxis
          stroke="hsl(218 18% 68%)"
          fontSize={10}
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
                    <span className="text-muted-foreground">
                      {p.dataKey === "daxil" ? "Mədaxil" : p.dataKey === "xaric" ? "Məxaric" : "Net"}:
                    </span>
                    <span className="font-medium">{formatMoney(p.value as number)}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px" }}
          formatter={(v) => (v === "daxil" ? "Mədaxil" : v === "xaric" ? "Məxaric" : "Net")}
        />
        <Area
          type="monotone"
          dataKey="daxil"
          stroke="hsl(160 60% 52%)"
          fill="url(#daxilFill)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="xaric"
          stroke="hsl(0 91% 71%)"
          fill="url(#xaricFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
