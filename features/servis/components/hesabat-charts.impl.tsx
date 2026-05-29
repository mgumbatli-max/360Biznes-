"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/utils";

const PALETTE = ["#22d3ee", "#a78bfa", "#fb923c", "#34d399", "#f472b6", "#fbbf24", "#60a5fa", "#f87171"];

export function TechPerfChart({ data }: { data: { ad_soyad: string; say: number; gelir: number; avg_gun: number }[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  }
  const maxGelir = Math.max(...data.map((d) => d.gelir), 1);
  const maxSay = Math.max(...data.map((d) => d.say), 1);
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 60, left: 120, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" horizontal={false} />
        <XAxis
          type="number"
          stroke="hsl(218 18% 68%)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          domain={[0, Math.max(maxGelir, maxSay * (maxGelir / Math.max(maxSay, 1)))]}
        />
        <YAxis dataKey="ad_soyad" type="category" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} width={120} />
        <Tooltip
          cursor={{ fill: "hsl(228 32% 22% / 0.2)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload;
            return (
              <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg">
                <div className="font-semibold">{r.ad_soyad}</div>
                <div>Sifariş: {r.say}</div>
                <div>Gəlir: {formatMoney(r.gelir)}</div>
                <div>Orta gün: {r.avg_gun}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="gelir" radius={[0, 4, 4, 0]}>
          {data.map((_, idx) => (
            <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopFailChart({ data }: { data: { mehsul_ad: string; say: number }[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 80, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" horizontal={false} />
        <XAxis type="number" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis dataKey="mehsul_ad" type="category" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} width={140} />
        <Tooltip
          cursor={{ fill: "hsl(228 32% 22% / 0.2)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg">
                <div className="font-semibold">{payload[0].payload.mehsul_ad}</div>
                <div>Say: {payload[0].value}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="say" radius={[0, 4, 4, 0]}>
          {data.map((_, idx) => (
            <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data }: { data: { ay: string; say: number; gelir: number }[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="ay" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="right"
          orientation="right"
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
              <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg">
                <div className="font-semibold">{label}</div>
                {payload.map((p) => (
                  <div key={p.dataKey as string}>
                    {p.dataKey === "gelir" ? `Gəlir: ${formatMoney(Number(p.value))}` : `Sifariş: ${p.value}`}
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Line yAxisId="left" type="monotone" dataKey="say" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 3 }} />
        <Line yAxisId="right" type="monotone" dataKey="gelir" stroke="#34d399" strokeWidth={2} dot={{ fill: "#34d399", r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
