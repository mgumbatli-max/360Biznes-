"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, RefreshCw } from "lucide-react";
import { seededRandom } from "@/lib/seeded-random";

/** Simple linear regression: y = a + b*x */
function linearRegression(values: number[]) {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = values.reduce((s, y) => s + y, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const b = den === 0 ? 0 : num / den;
  const a = yMean - b * xMean;
  return { a, b };
}

function generate(rand: () => number = Math.random): number[] {
  const base = 800;
  const trend = 12; // upward
  const noise = 100;
  return Array.from({ length: 14 }, (_, i) => Math.max(0, Math.round(base + trend * i + (rand() - 0.5) * noise)));
}

export function SandboxTrendForecast() {
  // İlkin data seed-li (deterministik) → SSR=client, #418 yoxdur; mount sonrası randomlaşır.
  const [history, setHistory] = useState<number[]>(() => generate(seededRandom(3)));
  useEffect(() => setHistory(generate()), []);
  const days = 7;

  const { forecast, slope } = useMemo(() => {
    const { a, b } = linearRegression(history);
    const fc: number[] = [];
    for (let i = 0; i < days; i++) {
      const x = history.length + i;
      fc.push(Math.max(0, a + b * x));
    }
    return { forecast: fc, slope: b };
  }, [history]);

  const all = [...history, ...forecast];
  const max = Math.max(...all, 1);

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Satış proqnozu — linear regression
        </CardTitle>
        <button type="button" onClick={() => setHistory(generate())} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-secondary">
          <RefreshCw className="h-3 w-3" />
          Yeni nümunə
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Box label="Slope (gündəlik artım)" value={`${slope.toFixed(1)} ₼/gün`} tone={slope >= 0 ? "success" : "danger"} />
          <Box label="Bu həftə proqnoz" value={`${forecast.reduce((s, v) => s + v, 0).toFixed(0)} ₼`} tone="primary" />
          <Box label="Keçən 14 gün" value={`${history.reduce((s, v) => s + v, 0).toFixed(0)} ₼`} tone="neutral" />
        </div>

        {/* Chart */}
        <div className="relative h-40 rounded-lg border border-border bg-secondary/20 p-2">
          <svg viewBox={`0 0 ${all.length} 100`} preserveAspectRatio="none" className="h-full w-full">
            {/* History bars */}
            {history.map((v, i) => (
              <rect key={`h${i}`} x={i + 0.1} y={100 - (v / max) * 95} width={0.8} height={(v / max) * 95} fill="hsl(228 100% 67%)" opacity="0.7" />
            ))}
            {/* Forecast bars (different color) */}
            {forecast.map((v, i) => (
              <rect key={`f${i}`} x={history.length + i + 0.1} y={100 - (v / max) * 95} width={0.8} height={(v / max) * 95} fill="hsl(160 60% 52%)" opacity="0.7" stroke="hsl(160 60% 40%)" strokeWidth="0.05" strokeDasharray="0.3 0.2" />
            ))}
          </svg>
          <div className="pointer-events-none absolute top-1 right-2 flex items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary opacity-70" />Tarixçə</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 opacity-70" />Proqnoz</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Box({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" | "primary" | "neutral" }) {
  const cls = tone === "success" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500" : tone === "danger" ? "border-rose-500/30 bg-rose-500/5 text-rose-500" : tone === "primary" ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-secondary/30";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
