"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, RefreshCw } from "lucide-react";
import { seededRandom } from "@/lib/seeded-random";

const DOW = ["Be", "Ç.A", "Çr", "Cü.A", "Cu", "Şn", "Bz"];

function generateMockData(rand: () => number = Math.random): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  // Simulate higher activity weekday evenings, weekend afternoons
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      let base = 0;
      if (h >= 9 && h <= 21) base = 5 + rand() * 10;
      if (h >= 12 && h <= 14) base += 3 + rand() * 5; // lunch
      if (h >= 18 && h <= 20) base += 5 + rand() * 8; // evening
      if (d >= 5 && h >= 14 && h <= 18) base += 6; // weekend afternoon
      if (h < 8 || h >= 23) base = rand() * 1;
      grid[d][h] = Math.round(base);
    }
  }
  return grid;
}

export function SandboxKpiHeatmap() {
  // İlkin data seed-li (deterministik) → SSR=client, #418 yoxdur; mount sonrası randomlaşır.
  const [grid, setGrid] = useState<number[][]>(() => generateMockData(seededRandom(2)));
  useEffect(() => setGrid(generateMockData()), []);

  const max = useMemo(() => Math.max(...grid.flat(), 1), [grid]);
  const best = useMemo(() => {
    let bestD = 0, bestH = 0, bestV = -1;
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (grid[d][h] > bestV) { bestV = grid[d][h]; bestD = d; bestH = h; }
    return { d: bestD, h: bestH, v: bestV };
  }, [grid]);

  const bg = (v: number) => {
    if (v === 0) return "bg-secondary/30";
    const p = v / max;
    if (p < 0.2) return "bg-emerald-500/15";
    if (p < 0.4) return "bg-emerald-500/40";
    if (p < 0.6) return "bg-amber-500/55";
    if (p < 0.8) return "bg-orange-500/70";
    return "bg-rose-500/85";
  };

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-rose-500" />
          Satış heatmap — gün × saat
        </CardTitle>
        <button
          type="button"
          onClick={() => setGrid(generateMockData())}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-secondary"
        >
          <RefreshCw className="h-3 w-3" />
          Yenidən simulyasiya
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
          <strong className="text-rose-500">İsti nöqtə:</strong> {DOW[best.d]} günü saat {String(best.h).padStart(2, "0")}:00 — {best.v} satış. Bu saatlarda kassir sayını artırın.
        </div>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[2px]">
            <thead>
              <tr>
                <th className="w-7"></th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="w-7 text-center text-[9px] font-mono text-muted-foreground">{String(h).padStart(2, "0")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOW.map((label, d) => (
                <tr key={d}>
                  <td className="pr-2 text-right text-[10px] font-mono font-semibold text-muted-foreground">{label}</td>
                  {grid[d].map((v, h) => (
                    <td key={h} title={`${label} ${String(h).padStart(2, "0")}:00 — ${v} satış`} className={`h-6 w-7 rounded ${bg(v)}`} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Az</span>
          <div className="flex gap-0.5">
            <span className="h-3 w-3 rounded bg-emerald-500/15" />
            <span className="h-3 w-3 rounded bg-emerald-500/40" />
            <span className="h-3 w-3 rounded bg-amber-500/55" />
            <span className="h-3 w-3 rounded bg-orange-500/70" />
            <span className="h-3 w-3 rounded bg-rose-500/85" />
          </div>
          <span>Çox</span>
        </div>
      </CardContent>
    </Card>
  );
}
