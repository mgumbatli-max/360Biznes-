"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyLeadPoint, FunnelSlice, LeadSourceSlice, LeadSourceAnalytics } from "../dashboard-queries";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

const PALETTE = ["#6366f1", "#22d3ee", "#a78bfa", "#f59e0b", "#34d399", "#f87171", "#fb7185", "#facc15"];

export function DailyChart({ data }: { data: DailyLeadPoint[] }) {
  const display = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: formatDate(d.date, { day: "2-digit", month: "short" }),
      })),
    [data]
  );
  if (display.every((d) => d.count === 0)) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Son 30 gündə yeni lead yoxdur
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={display} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis dataKey="label" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} interval={3} />
        <YAxis stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.[0]) return null;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{label}</div>
                <div className="mt-1 text-muted-foreground">
                  Lead: <span className="font-medium text-foreground">{payload[0].value}</span>
                </div>
              </div>
            );
          }}
        />
        <Area type="monotone" dataKey="count" stroke="#a78bfa" strokeWidth={2} fill="url(#leadsGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SourcesChart({ data }: { data: LeadSourceSlice[] }) {
  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Mənbə yoxdur</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const p = payload[0].payload as LeadSourceSlice;
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{p.menbe}</div>
                <div className="mt-1 text-muted-foreground">
                  Say: <span className="font-medium text-foreground">{p.count}</span>
                </div>
              </div>
            );
          }}
        />
        <Pie data={data} dataKey="count" nameKey="menbe" outerRadius={90} innerRadius={45} stroke="hsl(228 32% 14%)" strokeWidth={1}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

const STAGE_LABELS: Record<string, string> = {
  yeni: "Yeni",
  elaqe: "Əlaqədə",
  muzakire: "Müzakirə",
  teklif: "Təklif",
  qazandi: "Qazanıldı",
  itirdi: "İtirildi",
};

export function FunnelChart({ data }: { data: FunnelSlice[] }) {
  const display = data
    .filter((d) => d.status !== "itirdi")
    .map((d) => ({ ...d, label: STAGE_LABELS[d.status] ?? d.status }));
  if (display.every((d) => d.count === 0)) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Lead yoxdur</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={display} layout="vertical" margin={{ top: 4, right: 12, left: 60, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" horizontal={false} />
        <XAxis type="number" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} width={70} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const p = payload[0].payload as FunnelSlice & { label: string };
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{p.label}</div>
                <div className="mt-1 text-muted-foreground">
                  Say: <span className="font-medium text-foreground">{p.count}</span>
                </div>
                <div className="text-muted-foreground">
                  Dəyər:{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(p.value)}
                  </span>
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
          {display.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  telefon: "Telefon",
  magaza: "Walk-in",
  vebsayt: "Website",
  tovsiye: "Tövsiyə",
  reklam: "Reklam",
  tap_az: "Tap.az",
  "tap.az": "Tap.az",
  "nam_lum": "Naməlum",
  "naməlum": "Naməlum",
};

export function SourceAnalyticsChart({ data }: { data: LeadSourceAnalytics[] }) {
  if (!data.length || data.every((d) => d.total === 0)) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Lead qaynağı yoxdur</div>;
  }
  const display = data.map((d) => ({
    ...d,
    label: SOURCE_LABEL[d.menbe] ?? d.menbe,
  }));
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={display} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
          <XAxis dataKey="label" stroke="hsl(218 18% 68%)" fontSize={10} tickLine={false} axisLine={false} angle={-20} textAnchor="end" />
          <YAxis stroke="hsl(218 18% 68%)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const p = payload[0].payload as LeadSourceAnalytics & { label: string };
              return (
                <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                  <div className="font-semibold">{p.label}</div>
                  <div className="mt-1 text-muted-foreground">Cəmi lead: <span className="font-medium text-foreground">{p.total}</span></div>
                  <div className="text-muted-foreground">Qazanıldı: <span className="font-medium text-emerald-300">{p.won}</span></div>
                  <div className="text-muted-foreground">Dönüşüm: <span className="font-medium text-foreground">{p.conversion.toFixed(1)}%</span></div>
                  <div className="text-muted-foreground">Gəlir: <span className="font-medium text-foreground">{formatMoney(p.revenue)}</span></div>
                </div>
              );
            }}
          />
          <Bar dataKey="total" radius={[6, 6, 0, 0]}>
            {display.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="rounded-lg border border-border/40 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40">
            <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-1.5">Qaynaq</th>
              <th className="px-3 py-1.5 text-right">Lead</th>
              <th className="px-3 py-1.5 text-right">Qazan</th>
              <th className="px-3 py-1.5 text-right">Dönüşüm</th>
              <th className="px-3 py-1.5 text-right">Gəlir</th>
              <th className="px-3 py-1.5 text-right">Xərc</th>
              <th className="px-3 py-1.5 text-right">ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {display.map((d, i) => (
              <tr key={i} className="hover:bg-secondary/30">
                <td className="px-3 py-1.5 font-medium">{d.label}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{d.total}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-emerald-300">{d.won}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{d.conversion.toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(Math.round(d.revenue), 0) + " ₼"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{d.cost > 0 ? formatNumber(Math.round(d.cost), 0) + " ₼" : "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{d.roi > 0 ? `${d.roi.toFixed(1)}x` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const CrmDashboardCharts = {
  Daily: DailyChart,
  Sources: SourcesChart,
  Funnel: FunnelChart,
  SourceAnalytics: SourceAnalyticsChart,
};
