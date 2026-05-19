"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Calculator } from "lucide-react";

export function SandboxRoiCalc() {
  const [investment, setInvestment] = useState(1000);
  const [revenue, setRevenue] = useState(2500);
  const [costs, setCosts] = useState(800);
  const [days, setDays] = useState(30);

  const result = useMemo(() => {
    const profit = revenue - costs - investment;
    const roi = investment > 0 ? (profit / investment) * 100 : 0;
    const paybackDays = profit > 0 && days > 0 ? Math.ceil((investment / (profit / days)) * 1) : null;
    return { profit, roi, paybackDays };
  }, [investment, revenue, costs, days]);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" />
          ROI hesablama
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="İnvestisiya (AZN)" value={investment} onChange={setInvestment} />
          <Field label="Gəlir (AZN)" value={revenue} onChange={setRevenue} />
          <Field label="Operativ xərc (AZN)" value={costs} onChange={setCosts} />
          <Field label="Dövr (gün)" value={days} onChange={setDays} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <KpiBox label="Net mənfəət" value={`${result.profit.toFixed(0)} ₼`} tone={result.profit >= 0 ? "success" : "danger"} />
          <KpiBox label="ROI %" value={`${result.roi.toFixed(1)}%`} tone={result.roi >= 0 ? "success" : "danger"} icon={TrendingUp} />
          <KpiBox label="Payback dövrü" value={result.paybackDays != null ? `${result.paybackDays} gün` : "—"} tone="neutral" />
        </div>

        <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Formula:</strong> ROI = (Gəlir − Xərc − İnvestisiya) ÷ İnvestisiya × 100%
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold tabular-nums"
      />
    </div>
  );
}

function KpiBox({ label, value, tone, icon: Icon }: { label: string; value: string; tone: "success" | "danger" | "neutral"; icon?: React.ComponentType<{ className?: string }> }) {
  const cls = tone === "success" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500" : tone === "danger" ? "border-rose-500/30 bg-rose-500/5 text-rose-500" : "border-border bg-secondary/30 text-foreground";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-75">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
