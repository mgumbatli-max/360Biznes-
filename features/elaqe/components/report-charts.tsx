"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/utils";

export function MonthlyNewChart({ data }: { data: { month: string; count: number }[] }) {
  if (!data.length) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Məlumat yoxdur</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="month" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{label}</div>
                <div>Yeni: <span className="font-semibold text-foreground">{payload[0].value}</span></div>
              </div>
            );
          }}
        />
        <Bar dataKey="count" fill="hsl(220 92% 65%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DebtBucketsChart({ data }: { data: { label: string; count: number; sum: number }[] }) {
  const isEmpty = data.every((d) => d.count === 0);
  if (isEmpty) return <p className="py-6 text-center text-xs text-muted-foreground">Borclu yoxdur</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="label" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
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
            const v = payload[0].payload as { count: number; sum: number };
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{label} gün</div>
                <div>{v.count} qeyd</div>
                <div>{formatMoney(v.sum)}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="sum" fill="hsl(38 100% 60%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ["hsl(160 60% 52%)", "hsl(220 18% 68%)"];

export function StatusPieChart({ aktiv, passiv }: { aktiv: number; passiv: number }) {
  const data = [
    { name: "Aktiv", value: aktiv },
    { name: "Passiv", value: passiv },
  ];
  if (aktiv + passiv === 0)
    return <p className="py-6 text-center text-xs text-muted-foreground">Kontragent yoxdur</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
