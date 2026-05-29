"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatNumber } from "@/lib/utils";

export const PALETTE = [
  "#6366f1",
  "#22d3ee",
  "#a78bfa",
  "#f59e0b",
  "#34d399",
  "#f87171",
  "#fb7185",
  "#facc15",
  "#60a5fa",
  "#fb923c",
];

function EmptyState({ msg = "Məlumat yoxdur", height = 240 }: { msg?: string; height?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground" style={{ height }}>
      <span className="text-2xl">📊</span>
      <p className="font-medium text-foreground">{msg}</p>
    </div>
  );
}

type DailyPoint = { date: string; amount: number; count: number };

export function DailyLineChart({ data, height = 260 }: { data: DailyPoint[]; height?: number }) {
  if (!data.length || data.every((d) => d.amount === 0)) return <EmptyState msg="Bu dövrdə satış yoxdur" height={height} />;
  const display = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("az-AZ", { day: "2-digit", month: "short" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={display} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="hesab-d-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="label" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis
          stroke="hsl(218 18% 68%)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.[0]) return null;
            const p = payload[0].payload as DailyPoint;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{label}</div>
                <div className="mt-1 text-muted-foreground">
                  Məbləğ: <span className="font-medium text-foreground">{formatMoney(p.amount)}</span>
                </div>
                <div className="text-muted-foreground">
                  Sifariş: <span className="font-medium text-foreground">{p.count}</span>
                </div>
              </div>
            );
          }}
        />
        <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} fill="url(#hesab-d-grad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

type PieSlice = { name: string; value: number };

export function PiePaymentChart({ data, height = 260 }: { data: PieSlice[]; height?: number }) {
  const display = data.filter((d) => d.value > 0);
  if (display.length === 0) return <EmptyState height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const p = payload[0].payload as PieSlice;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{p.name}</div>
                <div className="mt-1 text-muted-foreground">
                  Məbləğ: <span className="font-medium text-foreground">{formatMoney(p.value)}</span>
                </div>
              </div>
            );
          }}
        />
        <Pie data={display} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45} stroke="hsl(228 32% 14%)" strokeWidth={1}>
          {display.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

type BarRow = { label: string; value: number; sub?: number };

export function HorizontalBarChart({ data, height = 280, label = "Məbləğ" }: { data: BarRow[]; height?: number; label?: string }) {
  if (data.length === 0) return <EmptyState height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 16, left: 80, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" horizontal={false} />
        <XAxis type="number" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))} />
        <YAxis dataKey="label" type="category" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} width={130} />
        <Tooltip
          cursor={{ fill: "hsl(228 32% 22% / 0.2)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const p = payload[0].payload as BarRow;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{p.label}</div>
                <div className="mt-1">
                  {label}: <span className="font-medium">{formatMoney(p.value)}</span>
                </div>
                {p.sub != null && (
                  <div className="text-muted-foreground">Sayı: {formatNumber(p.sub, 0)}</div>
                )}
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

type InOutDay = { date: string; daxil: number; xaric: number };

export function InOutLineChart({ data, height = 280 }: { data: InOutDay[]; height?: number }) {
  if (!data.length || data.every((d) => d.daxil === 0 && d.xaric === 0)) return <EmptyState msg="Hərəkət yoxdur" height={height} />;
  const display = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("az-AZ", { day: "2-digit", month: "short" }),
    net: d.daxil - d.xaric,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={display} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="label" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{label}</div>
                {payload.map((p) => (
                  <div key={p.dataKey as string} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-muted-foreground">
                      {p.dataKey === "daxil" ? "Mədaxil" : p.dataKey === "xaric" ? "Məxaric" : "Net"}:
                    </span>
                    <span className="font-medium">{formatMoney(Number(p.value))}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "daxil" ? "Mədaxil" : v === "xaric" ? "Məxaric" : "Net")} />
        <Line type="monotone" dataKey="daxil" stroke="hsl(160 60% 52%)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="xaric" stroke="hsl(0 91% 71%)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="net" stroke="hsl(228 18% 80%)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

type MonthlyPlPoint = { ay: string; revenue: number; gross: number; net: number; opex: number };

export function MonthlyPlChart({ data, height = 300 }: { data: MonthlyPlPoint[]; height?: number }) {
  if (!data.length || data.every((d) => d.revenue === 0)) return <EmptyState msg="Son 12 ayda satış yoxdur" height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="ay" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="mb-1 font-semibold">{label}</div>
                {payload.map((p) => (
                  <div key={p.dataKey as string} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-muted-foreground capitalize">{String(p.dataKey)}:</span>
                    <span className="font-medium">{formatMoney(Number(p.value))}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="gross" stroke="#34d399" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="opex" stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
