"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestTube } from "lucide-react";

function zScore(p1: number, p2: number, n1: number, n2: number) {
  const p = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return 0;
  return Math.abs(p1 - p2) / se;
}

export function SandboxAbTest() {
  const [aVisits, setAVisits] = useState(1000);
  const [aConv, setAConv] = useState(85);
  const [bVisits, setBVisits] = useState(1000);
  const [bConv, setBConv] = useState(110);

  const stats = useMemo(() => {
    const aRate = aVisits > 0 ? aConv / aVisits : 0;
    const bRate = bVisits > 0 ? bConv / bVisits : 0;
    const uplift = aRate > 0 ? ((bRate - aRate) / aRate) * 100 : 0;
    const z = zScore(aRate, bRate, aVisits, bVisits);
    // Two-tailed: 1.96 ≈ 95%, 2.58 ≈ 99%
    const significant95 = z >= 1.96;
    const significant99 = z >= 2.58;
    return { aRate, bRate, uplift, z, significant95, significant99 };
  }, [aVisits, aConv, bVisits, bConv]);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TestTube className="h-4 w-4 text-primary" />
          A/B Test — statistical significance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Variant label="A — Control" visits={aVisits} conv={aConv} setVisits={setAVisits} setConv={setAConv} rate={stats.aRate} color="indigo" />
          <Variant label="B — Variant" visits={bVisits} conv={bConv} setVisits={setBVisits} setConv={setBConv} rate={stats.bRate} color="emerald" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Uplift</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${stats.uplift >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {stats.uplift >= 0 ? "+" : ""}{stats.uplift.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Z-score</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{stats.z.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Statistik</div>
            <div className={`mt-1 text-sm font-bold ${stats.significant99 ? "text-emerald-500" : stats.significant95 ? "text-primary" : "text-rose-500"}`}>
              {stats.significant99 ? "Çox güclü (99%)" : stats.significant95 ? "Əhəmiyyətli (95%)" : "Əhəmiyyətsiz"}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">İzah:</strong> Z ≥ 1.96 ⇒ 95% etibarlılıq, Z ≥ 2.58 ⇒ 99%. Daha çox sample ⇒ daha çox dəqiqlik.
        </div>
      </CardContent>
    </Card>
  );
}

function Variant({
  label, visits, conv, setVisits, setConv, rate, color,
}: {
  label: string; visits: number; conv: number; setVisits: (v: number) => void; setConv: (v: number) => void; rate: number; color: "indigo" | "emerald";
}) {
  const cls = color === "emerald" ? "border-emerald-500/30 bg-emerald-500/5" : "border-indigo-500/30 bg-indigo-500/5";
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${cls}`}>
      <div className="text-sm font-bold">{label}</div>
      <div>
        <label className="text-xs text-muted-foreground">Visits</label>
        <input type="number" value={visits} onChange={(e) => setVisits(Number(e.target.value))} className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-sm tabular-nums" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Konversiya</label>
        <input type="number" value={conv} onChange={(e) => setConv(Number(e.target.value))} className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-sm tabular-nums" />
      </div>
      <div className="rounded bg-background/60 p-2 text-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rate</div>
        <div className="text-xl font-bold tabular-nums">{(rate * 100).toFixed(2)}%</div>
      </div>
    </div>
  );
}
