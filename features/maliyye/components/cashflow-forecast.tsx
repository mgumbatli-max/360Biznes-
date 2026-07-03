"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/utils";
import type { ForecastBucket } from "../cashflow-queries";

type Range = 30 | 60 | 90;

export function CashflowForecast({ initialRange = 30, data }: { initialRange?: Range; data: ForecastBucket[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [range, setRange] = useState<Range>(initialRange);

  function changeRange(r: Range) {
    setRange(r);
    const params = new URLSearchParams(sp.toString());
    params.set("forecast", String(r));
    router.push(`?${params.toString()}`);
  }

  const totalIn = data.reduce((s, b) => s + b.expected_in, 0);
  const totalOut = data.reduce((s, b) => s + b.recurring_out + b.supplier_out, 0);
  const totalNet = totalIn - totalOut;
  const maxAbs = Math.max(1, ...data.flatMap((b) => [b.expected_in, b.recurring_out + b.supplier_out]));

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Pul axını proqnozu
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Müştəri borcları (alacaq), təchizatçı borcları və aylıq əmək haqqı əsasında haftəlik təxmin.
            </p>
          </div>
          <div className="inline-flex rounded-md border border-border bg-card/40 p-0.5 text-xs">
            {[30, 60, 90].map((r) => (
              <button
                key={r}
                onClick={() => changeRange(r as Range)}
                className={`rounded px-2.5 py-1 font-medium transition ${
                  range === r ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r} gün
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-2.5 w-2.5" /> Gözlənilən gəlir
            </div>
            <div className="mt-0.5 text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoney(totalIn)}</div>
          </div>
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-2.5 w-2.5" /> Gözlənilən xərc
            </div>
            <div className="mt-0.5 text-base font-bold tabular-nums text-rose-700 dark:text-rose-400">{formatMoney(totalOut)}</div>
          </div>
          <div className={`rounded-md border px-3 py-2 ${totalNet >= 0 ? "border-emerald-500/40 bg-emerald-500/15" : "border-rose-500/40 bg-rose-500/15"}`}>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
              Net axın
              {totalNet < 0 && <AlertTriangle className="h-2.5 w-2.5 text-rose-500" />}
            </div>
            <div className={`mt-0.5 text-base font-bold tabular-nums ${totalNet >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {totalNet >= 0 ? "+" : ""}{formatMoney(totalNet)}
            </div>
          </div>
        </div>

        {/* Weekly bars */}
        <div className="space-y-1.5">
          {data.map((b, i) => {
            const inPct = (b.expected_in / maxAbs) * 100;
            const outPct = ((b.recurring_out + b.supplier_out) / maxAbs) * 100;
            const weekLabel = formatDate(b.bucket, { day: "2-digit", month: "short" });
            return (
              <div key={b.bucket} className="grid grid-cols-[80px_1fr_100px] items-center gap-2 text-xs">
                <span className="text-muted-foreground">H{i + 1} · {weekLabel}</span>
                <div className="space-y-0.5">
                  <div className="flex h-2 overflow-hidden rounded-full bg-secondary/30">
                    <div className="h-full bg-emerald-500/70" style={{ width: `${inPct}%` }} title={`Daxil: ${formatMoney(b.expected_in)}`} />
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-secondary/30">
                    <div className="h-full bg-rose-500/70" style={{ width: `${outPct}%` }} title={`Xaric: ${formatMoney(b.recurring_out + b.supplier_out)}`} />
                  </div>
                </div>
                <Badge variant="outline" className={`justify-center text-[10.5px] ${b.net >= 0 ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-rose-500/40 text-rose-600 dark:text-rose-400"}`}>
                  {b.net >= 0 ? "+" : ""}{formatMoney(b.net)}
                </Badge>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground">
          ⓘ Proqnoz model: müştəri borcları (alacaq) və təchizatçı borcları seçilmiş aralıqda eyni paylanır
          (30 günlük ödəniş termini). Aylıq maaş ayın 1-i həftəsinə qoyulur. Daha dəqiq forecast üçün gələcəkdə
          payment_terms cədvəli istifadə oluna bilər.
        </p>
      </CardContent>
    </Card>
  );
}
