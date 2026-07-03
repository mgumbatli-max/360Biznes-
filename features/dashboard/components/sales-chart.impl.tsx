"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatMoney } from "@/lib/utils";
import type { DailySalesPoint } from "../queries";

type Props = {
  data: DailySalesPoint[];
};

// DETERMINISTIK Bakı (UTC+4) qısa gün adları — formatDate weekday dəstəkləmir,
// Intl isə server/brauzer ICU-ya görə fərqli nəticə verib React #418-ə səbəb olurdu.
const AZ_WEEKDAYS_SHORT = ["B.", "B.E.", "Ç.A.", "Ç.", "C.A.", "C.", "Ş."];
function weekdayShortBaku(value: string): string {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "";
  return AZ_WEEKDAYS_SHORT[new Date(t + 4 * 60 * 60 * 1000).getUTCDay()];
}

export default function SalesChartImpl({ data }: Props) {
  const display = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: `${weekdayShortBaku(d.date)} ${formatDate(d.date, { day: "numeric" })}`,
      })),
    [data]
  );

  const isEmpty = display.every((d) => d.amount === 0);

  if (isEmpty) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <span className="text-3xl">📊</span>
        <p className="font-medium text-foreground">Hələ satış yoxdur</p>
        <p className="text-xs">İlk satışınız edildikdə qrafiq buraya gələcək.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={display} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(239 84% 67%)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="hsl(262 83% 67%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="hsl(218 18% 68%)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
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
            const item = payload[0].payload as DailySalesPoint & { label: string };
            return (
              <div className="glass rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div className="font-semibold">{label}</div>
                <div className="mt-1 text-muted-foreground">
                  Məbləğ:{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(item.amount)}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Sifariş: <span className="font-medium text-foreground">{item.count}</span>
                </div>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="hsl(239 84% 67%)"
          strokeWidth={2}
          fill="url(#salesGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
