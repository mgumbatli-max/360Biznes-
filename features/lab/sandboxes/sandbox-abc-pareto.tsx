"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sigma } from "lucide-react";

type Item = { ad: string; gelir: number };

const SAMPLE: Item[] = [
  { ad: "iPhone 15 Pro", gelir: 24500 },
  { ad: "MacBook Air M3", gelir: 18900 },
  { ad: "AirPods Pro", gelir: 7800 },
  { ad: "iPad 10", gelir: 6200 },
  { ad: "Watch S9", gelir: 4100 },
  { ad: "Apple TV 4K", gelir: 2400 },
  { ad: "Magic Mouse", gelir: 1900 },
  { ad: "USB-C kabel", gelir: 1500 },
  { ad: "MagSafe charger", gelir: 1200 },
  { ad: "Lightning kabel", gelir: 900 },
  { ad: "Tibbi paket", gelir: 600 },
  { ad: "Sticker pack", gelir: 350 },
  { ad: "Daşıyıcı qutu", gelir: 280 },
  { ad: "Ekran qoruyucu", gelir: 220 },
  { ad: "Qələm dəsti", gelir: 140 },
];

export function SandboxAbcPareto() {
  const [items] = useState<Item[]>(SAMPLE);

  const sorted = useMemo(() => [...items].sort((a, b) => b.gelir - a.gelir), [items]);
  const total = sorted.reduce((s, i) => s + i.gelir, 0);

  const classified = useMemo(() => {
    const result: (Item & { cumPct: number; share: number; cls: "A" | "B" | "C" })[] = [];
    let cum = 0;
    for (const item of sorted) {
      cum = cum + item.gelir;
      const cumPct = (cum / total) * 100;
      const cls: "A" | "B" | "C" = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
      result.push({ ...item, cumPct, share: (item.gelir / total) * 100, cls });
    }
    return result;
  }, [sorted, total]);

  const counts = useMemo(() => {
    const c = { A: 0, B: 0, C: 0 };
    for (const i of classified) c[i.cls]++;
    return c;
  }, [classified]);

  const sumsByClass = useMemo(() => {
    const s = { A: 0, B: 0, C: 0 };
    for (const i of classified) s[i.cls] += i.gelir;
    return s;
  }, [classified]);

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sigma className="h-4 w-4 text-primary" />
            ABC analizi — Pareto qaydası
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Box cls="A" count={counts.A} sum={sumsByClass.A} total={total} />
            <Box cls="B" count={counts.B} sum={sumsByClass.B} total={total} />
            <Box cls="C" count={counts.C} sum={sumsByClass.C} total={total} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Məhsul cədvəli</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Məhsul</th>
                <th className="px-3 py-2 text-right">Gəlir</th>
                <th className="px-3 py-2 text-right">Pay</th>
                <th className="px-3 py-2 text-right">Kümülativ</th>
                <th className="px-3 py-2 text-center">Sinif</th>
              </tr>
            </thead>
            <tbody>
              {classified.map((i, idx) => {
                const tone = i.cls === "A" ? "bg-emerald-500/5" : i.cls === "B" ? "bg-amber-500/5" : "bg-rose-500/5";
                const badge = i.cls === "A" ? "bg-emerald-500 text-white" : i.cls === "B" ? "bg-amber-500 text-white" : "bg-rose-500 text-white";
                return (
                  <tr key={i.ad} className={`border-b border-border/20 ${tone}`}>
                    <td className="px-3 py-2 text-xs">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{i.ad}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.gelir.toFixed(0)} ₼</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{i.share.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{i.cumPct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`grid h-6 w-6 mx-auto place-items-center rounded text-xs font-bold ${badge}`}>{i.cls}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Box({ cls, count, sum, total }: { cls: "A" | "B" | "C"; count: number; sum: number; total: number }) {
  const config = {
    A: { tone: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500", label: "A — Top performers", desc: "80% gəlir verir" },
    B: { tone: "border-amber-500/30 bg-amber-500/5 text-amber-500", label: "B — Normal", desc: "15% gəlir, qiymət monitorinqi" },
    C: { tone: "border-rose-500/30 bg-rose-500/5 text-rose-500", label: "C — Aşağı performans", desc: "Yoxlama tələb edir" },
  }[cls];
  const pct = total > 0 ? (sum / total) * 100 : 0;
  return (
    <div className={`rounded-lg border p-3 ${config.tone}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-75">{config.label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{count} <span className="text-sm opacity-75">məhsul</span></div>
      <div className="mt-0.5 text-xs">{sum.toFixed(0)} ₼ · {pct.toFixed(1)}%</div>
      <div className="mt-1 text-[10px] opacity-75">{config.desc}</div>
    </div>
  );
}
