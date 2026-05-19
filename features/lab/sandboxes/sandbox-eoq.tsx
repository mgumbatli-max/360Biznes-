"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator } from "lucide-react";

/**
 * EOQ = sqrt(2DS/H)
 * D = annual demand
 * S = ordering cost
 * H = holding cost per unit per year
 */
export function SandboxEoq() {
  const [demand, setDemand] = useState(1200);
  const [orderCost, setOrderCost] = useState(50);
  const [holdingCost, setHoldingCost] = useState(8);

  const result = useMemo(() => {
    const eoq = Math.sqrt((2 * demand * orderCost) / holdingCost);
    const ordersPerYear = demand / eoq;
    const cycleDays = 365 / ordersPerYear;
    const totalCost = Math.sqrt(2 * demand * orderCost * holdingCost);
    return { eoq, ordersPerYear, cycleDays, totalCost };
  }, [demand, orderCost, holdingCost]);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" />
          EOQ — Economic Order Quantity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <F label="İllik tələb (D, ədəd)" value={demand} onChange={setDemand} />
          <F label="Sifariş xərci (S, ₼)" value={orderCost} onChange={setOrderCost} />
          <F label="Saxlama xərci (H, ₼/ad)" value={holdingCost} onChange={setHoldingCost} />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Box label="EOQ" value={`${result.eoq.toFixed(0)} ad`} tone="primary" big />
          <Box label="İllik sifariş sayı" value={result.ordersPerYear.toFixed(1)} tone="neutral" />
          <Box label="Dövr (gün)" value={`${result.cycleDays.toFixed(0)} gün`} tone="neutral" />
          <Box label="Cəm illik xərc" value={`${result.totalCost.toFixed(0)} ₼`} tone="warning" />
        </div>

        <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Formula:</strong> EOQ = √(2 × D × S / H){"\n"}
          <strong className="text-foreground">Nəticə:</strong> Hər sifarişdə optimal {result.eoq.toFixed(0)} ədəd sifariş ver
          — ildə {result.ordersPerYear.toFixed(0)} dəfə (təxminən hər {result.cycleDays.toFixed(0)} gündən bir).
        </div>
      </CardContent>
    </Card>
  );
}

function F({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
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

function Box({ label, value, tone, big }: { label: string; value: string; tone: "primary" | "warning" | "neutral"; big?: boolean }) {
  const cls = tone === "primary" ? "border-primary/30 bg-primary/5 text-primary" : tone === "warning" ? "border-amber-500/30 bg-amber-500/5 text-amber-500" : "border-border bg-secondary/30";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
      <div className={`mt-1 font-bold tabular-nums ${big ? "text-2xl" : "text-lg"}`}>{value}</div>
    </div>
  );
}
