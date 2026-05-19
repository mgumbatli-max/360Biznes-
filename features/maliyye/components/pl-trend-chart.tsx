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

type Row = { ay: string; gelir: number; xerc: number; menfeet: number };

export function PLTrendChart({ data }: { data: Row[] }) {
  const isEmpty = data.every((d) => d.gelir === 0 && d.xerc === 0);
  if (isEmpty) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <span className="text-3xl">📊</span>
        <p className="font-medium text-foreground">Son 12 ayda hərəkət yoxdur</p>
        <p className="text-xs">Satış və xərclər qeydə alındıqda trend görünəcək.</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 32% 22%)" vertical={false} />
        <XAxis
          dataKey="ay"
          stroke="hsl(218 18% 68%)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
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
              <div className="rounded-md border border-border bg-card/95 p-2 text-xs shadow">
                <div className="font-semibold">{String(label)}</div>
                {payload.map((p) => (
                  <div key={String(p.dataKey)} className="flex items-center gap-2">
                    <span className="text-muted-foreground">{p.name}:</span>
                    <span className="tabular-nums" style={{ color: p.color }}>
                      {formatMoney(Number(p.value))}
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="gelir"
          name="Gəlir"
          stroke="hsl(142 76% 45%)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="xerc"
          name="Xərc"
          stroke="hsl(0 84% 60%)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="menfeet"
          name="Mənfəət"
          stroke="hsl(217 91% 60%)"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
