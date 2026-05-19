import type { Metadata } from "next";
import { GitCompare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerBranchComparison, getOwnerBranchTrend30 } from "@/features/sahibkar/owner-queries";
import { formatMoney } from "@/lib/utils";

function TrendSparkline({ values, color = "var(--brand-from, #6366f1)" }: { values: number[]; color?: string }) {
  if (values.length === 0) return null;
  const max = Math.max(1, ...values);
  const w = 200;
  const h = 40;
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${i * stepX},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const metadata: Metadata = { title: "Filial müqayisəsi" };
export const dynamic = "force-dynamic";

export default async function FilialMuqayisePage() {
  await requireSahibkarSession();
  const [rows, trendMap] = await Promise.all([getOwnerBranchComparison(), getOwnerBranchTrend30()]);
  const maxVal = Math.max(1, ...rows.flatMap((r) => [r.bu_ay, r.kecen_ay]));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Filial müqayisəsi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bu ay vs keçən ay — yanaşı və faiz dəyişiklik.</p>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <GitCompare className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Filial yoxdur</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const delta = r.kecen_ay > 0 ? ((r.bu_ay - r.kecen_ay) / r.kecen_ay) * 100 : (r.bu_ay > 0 ? 100 : 0);
            const trend = trendMap.get(r.id) ?? [];
            return (
              <Card key={r.id} className="glass">
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-semibold">{r.ad}</div>
                    <Badge variant="outline" className={delta >= 0 ? "text-success" : "text-danger"}>
                      {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                    </Badge>
                  </div>
                  {trend.length > 0 && (
                    <div className="flex items-center justify-between gap-3 border-b border-border/30 pb-2">
                      <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Son 30 gün trend</span>
                      <TrendSparkline values={trend} color={delta >= 0 ? "#10b981" : "#ef4444"} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Bu ay</span>
                      <span className="font-semibold tabular-nums">{formatMoney(r.bu_ay)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full" style={{ background: "var(--brand-gradient)", width: `${(r.bu_ay / maxVal) * 100}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Keçən ay</span>
                      <span className="tabular-nums">{formatMoney(r.kecen_ay)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-muted-foreground/40" style={{ width: `${(r.kecen_ay / maxVal) * 100}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
