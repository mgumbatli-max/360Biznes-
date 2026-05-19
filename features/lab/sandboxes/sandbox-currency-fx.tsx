"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";

const RATES_TO_AZN: Record<string, number> = {
  AZN: 1,
  USD: 1.7,
  EUR: 1.85,
  RUB: 0.018,
  GBP: 2.15,
  TRY: 0.05,
};

const FX_HISTORY = [
  { date: "01.04", USD: 1.7, EUR: 1.83, RUB: 0.0184 },
  { date: "08.04", USD: 1.7, EUR: 1.84, RUB: 0.0182 },
  { date: "15.04", USD: 1.7, EUR: 1.85, RUB: 0.018 },
  { date: "22.04", USD: 1.7, EUR: 1.86, RUB: 0.0181 },
  { date: "29.04", USD: 1.7, EUR: 1.85, RUB: 0.018 },
];

export function SandboxCurrencyFx() {
  const [amount, setAmount] = useState(1000);
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("AZN");

  const converted = useMemo(() => {
    const inAzn = amount * (RATES_TO_AZN[from] ?? 1);
    return inAzn / (RATES_TO_AZN[to] ?? 1);
  }, [amount, from, to]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Konvertor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Məbləğ</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-base font-bold tabular-nums"
            />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Kimdən</label>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                {Object.keys(RATES_TO_AZN).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={swap}
              className="mb-0 grid h-10 w-10 place-items-center rounded-md border border-border bg-card hover:bg-secondary"
              title="Tərsinə"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <div>
              <label className="text-xs text-muted-foreground">Kimə</label>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                {Object.keys(RATES_TO_AZN).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nəticə</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">
              {converted.toLocaleString("az-AZ", { maximumFractionDigits: 2 })} <span className="text-base text-muted-foreground">{to}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              1 {from} = {(RATES_TO_AZN[from] / RATES_TO_AZN[to]).toFixed(4)} {to}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" />
            Kurs tarixçəsi (test data)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Tarix</th>
                <th className="px-2 py-1.5 text-right">USD</th>
                <th className="px-2 py-1.5 text-right">EUR</th>
                <th className="px-2 py-1.5 text-right">RUB</th>
              </tr>
            </thead>
            <tbody>
              {FX_HISTORY.map((row, i) => {
                const prev = FX_HISTORY[i - 1];
                return (
                  <tr key={row.date} className="border-b border-border/20">
                    <td className="px-2 py-1.5 font-mono">{row.date}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.USD.toFixed(4)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      <span>{row.EUR.toFixed(4)}</span>
                      {prev && row.EUR !== prev.EUR && (
                        <span className={row.EUR > prev.EUR ? "ml-1 text-emerald-500" : "ml-1 text-rose-500"}>
                          {row.EUR > prev.EUR ? <TrendingUp className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.RUB.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Real API ilə (cbar.az) bağlantı production aktivasiyada qoşulur.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
