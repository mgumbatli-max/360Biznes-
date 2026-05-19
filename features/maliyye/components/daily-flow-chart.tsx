"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/utils";

type Row = { gun: string; daxil: number; xaric: number };

export function DailyFlowChart({ data }: { data: Row[] }) {
  const enriched = data.map((d) => ({ ...d, net: d.daxil - d.xaric }));
  const isEmpty = enriched.every((d) => d.daxil === 0 && d.xaric === 0);
  if (isEmpty) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <span className="text-3xl">📈</span>
        <p className="font-medium text-foreground">Son 30 gündə hərəkət yoxdur</p>
        <p className="text-xs">Satış və xərclər qeydə alındıqda qrafik buraya gələcək.</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={enriched} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis
          dataKey="gun"
          stroke="hsl(218 18% 68%)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v ? String(v).slice(-5) : "")}
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
                    <span className="font-medium text-foreground">
                      {formatMoney(p.value as number)}
                    </span>
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
        <Line type="monotone" dataKey="daxil" stroke="hsl(160 60% 52%)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="xaric" stroke="hsl(0 91% 71%)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="net" stroke="hsl(228 18% 80%)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
