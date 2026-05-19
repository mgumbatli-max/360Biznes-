"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatMoney } from "@/lib/utils";
import { SERVIS_STATUS_LABELS } from "../types";

const PALETTE = ["#22d3ee", "#a78bfa", "#fb923c", "#34d399", "#f472b6", "#fbbf24", "#60a5fa", "#f87171", "#94a3b8", "#c084fc"];

export function CycleTimeChart({ data }: { data: { ay: string; avg_gun: number; say: number }[] }) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="ay" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload;
            return (
              <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg">
                <div className="font-semibold">{label}</div>
                <div>Orta gün: {p.avg_gun}</div>
                <div>Servis sayı: {p.say}</div>
              </div>
            );
          }}
        />
        <Line type="monotone" dataKey="avg_gun" stroke="#a78bfa" strokeWidth={2} dot={{ fill: "#a78bfa", r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BottleneckChart({ data }: { data: { status: string; avg_saat: number; say: number }[] }) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  const enriched = data.map((d) => ({
    ...d,
    label: SERVIS_STATUS_LABELS[d.status]?.label ?? d.status,
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, enriched.length * 32)}>
      <BarChart data={enriched} layout="vertical" margin={{ top: 10, right: 20, left: 110, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" horizontal={false} />
        <XAxis type="number" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis dataKey="label" type="category" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} width={110} />
        <Tooltip
          cursor={{ fill: "hsl(228 32% 22% / 0.2)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload;
            return (
              <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg">
                <div className="font-semibold">{r.label}</div>
                <div>Ortalama: {r.avg_saat} saat</div>
                <div>Keçid sayı: {r.say}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="avg_saat" radius={[0, 4, 4, 0]}>
          {enriched.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CostRevenueChart({ data }: { data: { nomre: string; xerc: number; gelir: number; net: number }[] }) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 18)}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis
          dataKey="nomre"
          stroke="hsl(218 18% 68%)"
          fontSize={9}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload;
            return (
              <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg">
                <div className="font-semibold">{label}</div>
                <div>{r.mehsul_ad}</div>
                <div>Xərc: {formatMoney(r.xerc)}</div>
                <div>Gəlir: {formatMoney(r.gelir)}</div>
                <div className={r.net >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  Net: {formatMoney(r.net)}
                </div>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="xerc" stackId="a" fill="#f87171" name="Xərc" radius={[2, 2, 0, 0]} />
        <Bar dataKey="net" stackId="a" fill="#34d399" name="Net qazanc" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DefektPieChart({ data }: { data: { ad: string; say: number }[] }) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="say"
          nameKey="ad"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={40}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload;
            return (
              <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg">
                <div className="font-semibold">{r.ad}</div>
                <div>Say: {r.say}</div>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SourceSplitChart({ data }: { data: { ilk: number; tekrar: number } }) {
  const total = data.ilk + data.tekrar;
  if (total === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  const rows = [
    { name: "İlk dəfə", value: data.ilk },
    { name: "Təkrar", value: data.tekrar },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
          <Cell fill="#22d3ee" />
          <Cell fill="#fb923c" />
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DailyServisChart({ data }: { data: { gun: string; qebul: number; tehvil: number }[] }) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="gun" stroke="hsl(218 18% 68%)" fontSize={9} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="qebul" stroke="#22d3ee" name="Qəbul" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="tehvil" stroke="#34d399" name="Təhvil" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const DAYS = ["B", "B.e", "Ç.a", "Ç", "C.a", "C", "Ş"];

export function HourlyHeatmap({ data }: { data: { dow: number; saat: number; say: number }[] }) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  const max = Math.max(1, ...data.map((d) => d.say));
  const grid: Record<string, number> = {};
  for (const d of data) grid[`${d.dow}-${d.saat}`] = d.say;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="px-1 py-0.5 text-left text-muted-foreground">Gün</th>
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="px-1 py-0.5 text-center font-normal text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((d, dow) => (
            <tr key={dow}>
              <td className="px-1 py-0.5 text-muted-foreground">{d}</td>
              {Array.from({ length: 24 }, (_, h) => {
                const v = grid[`${dow}-${h}`] ?? 0;
                const intensity = v === 0 ? 0 : 0.15 + (v / max) * 0.85;
                return (
                  <td
                    key={h}
                    className="border border-border/20 text-center tabular-nums"
                    style={{
                      backgroundColor: v > 0 ? `rgba(34, 211, 238, ${intensity})` : "transparent",
                      width: 22,
                      height: 22,
                      color: intensity > 0.55 ? "#0a1129" : undefined,
                    }}
                    title={`${d} ${h}:00 — ${v} servis`}
                  >
                    {v > 0 ? v : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
