"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, RefreshCw } from "lucide-react";
import { seededRandom } from "@/lib/seeded-random";

type Cohort = { month: string; size: number; retention: number[] }; // retention[i] = % returned i months later

function generateCohorts(rand: () => number = Math.random): Cohort[] {
  const months = ["Mart", "Aprel", "May", "İyun", "İyul", "Avqust"];
  return months.map((m, idx) => {
    const size = Math.floor(80 + rand() * 120);
    const len = months.length - idx;
    const retention: number[] = [100];
    let last = 100;
    for (let i = 1; i < len; i++) {
      const decay = 10 + rand() * 18 - i * 1.5;
      last = Math.max(8, last - decay);
      retention.push(Math.round(last));
    }
    return { month: m, size, retention };
  });
}

export function SandboxCohort() {
  // İlkin data seed-li (deterministik) → SSR=client, #418 yoxdur; mount sonrası randomlaşır.
  const [cohorts, setCohorts] = useState<Cohort[]>(() => generateCohorts(seededRandom(1)));
  useEffect(() => setCohorts(generateCohorts()), []);
  const maxLen = useMemo(() => Math.max(...cohorts.map((c) => c.retention.length)), [cohorts]);

  const bg = (v: number) => {
    if (v >= 70) return "bg-emerald-500/85 text-white";
    if (v >= 50) return "bg-emerald-500/60 text-white";
    if (v >= 35) return "bg-amber-500/65 text-white";
    if (v >= 20) return "bg-orange-500/65 text-white";
    return "bg-rose-500/65 text-white";
  };

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Cohort Analysis — retention
        </CardTitle>
        <button type="button" onClick={() => setCohorts(generateCohorts())} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-secondary">
          <RefreshCw className="h-3 w-3" />
          Yeni nümunə
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Hər kohortda neçə % müştəri X ay sonra hələ də alış edir.
        </p>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Kohort</th>
                <th className="px-2 py-1 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Say</th>
                {Array.from({ length: maxLen }, (_, i) => (
                  <th key={i} className="w-14 px-2 py-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">M{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.month}>
                  <td className="px-2 py-1 text-xs font-semibold">{c.month}</td>
                  <td className="px-2 py-1 text-right text-xs tabular-nums">{c.size}</td>
                  {Array.from({ length: maxLen }, (_, i) => {
                    const v = c.retention[i];
                    if (v == null) return <td key={i} className="bg-secondary/20" />;
                    return (
                      <td key={i} className={`rounded text-center text-[11px] font-bold tabular-nums ${bg(v)}`}>
                        {v}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
