"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatNumber } from "@/lib/utils";

type Bucket = { gun: string; qty: number; mebleg: number };

export function ProductDailyChart({ data, days = 30 }: { data: Bucket[]; days?: number }) {
  if (!data || data.length === 0) {
    return (
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Son {days} gün satış trendi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">Bu məhsul üçün satış məlumatı yoxdur</p>
        </CardContent>
      </Card>
    );
  }

  const maxQty = Math.max(1, ...data.map((d) => d.qty));
  const maxMebleg = Math.max(1, ...data.map((d) => d.mebleg));
  const totalQty = data.reduce((s, d) => s + d.qty, 0);
  const totalMebleg = data.reduce((s, d) => s + d.mebleg, 0);
  const w = 600;
  const h = 100;
  const stepX = data.length > 1 ? w / (data.length - 1) : w;

  // İki xətt — sayı (sol axis) və mebleg (sağ axis), eyni viewport-da
  const qtyPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${i * stepX},${h - (d.qty / maxQty) * h}`).join(" ");
  const meblegPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${i * stepX},${h - (d.mebleg / maxMebleg) * h}`).join(" ");

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Son {days} gün satış trendi</CardTitle>
          <div className="flex items-center gap-3 text-[10.5px]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" /> Ədəd ({formatNumber(totalQty, 0)})
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Gəlir ({formatMoney(totalMebleg)})
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="overflow-visible">
          <path d={qtyPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" />
          <path d={meblegPath} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
          {data.map((d, i) => (
            <circle
              key={d.gun}
              cx={i * stepX}
              cy={h - (d.qty / maxQty) * h}
              r="2"
              fill="hsl(var(--primary))"
            >
              <title>{`${d.gun}: ${formatNumber(d.qty, 0)} ədəd, ${formatMoney(d.mebleg)}`}</title>
            </circle>
          ))}
        </svg>
        {/* X-axis labels (first, middle, last) */}
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{data[0]?.gun.slice(5)}</span>
          <span>{data[Math.floor(data.length / 2)]?.gun.slice(5)}</span>
          <span>{data[data.length - 1]?.gun.slice(5)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
