import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils";

type Row = {
  label: string;
  cur: number;
  prev: number;
  isPct?: boolean;
  goodUp?: boolean;
};

/**
 * Compact strip comparing two periods (e.g., bu il vs keçən il, bu ay vs keçən ay).
 * Used for YoY or any custom comparison.
 */
export function YoyStrip({
  title,
  curLabel,
  prevLabel,
  rows,
}: {
  title: string;
  curLabel: string;
  prevLabel: string;
  rows: Row[];
}) {
  const fmt = (v: number, isPct?: boolean) => (isPct ? `${v.toFixed(1)}%` : formatMoney(v));
  const delta = (cur: number, prev: number) => {
    if (prev === 0) return cur === 0 ? 0 : 100;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <span className="text-[10px] font-normal text-muted-foreground">{curLabel} vs {prevLabel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {rows.map((r) => {
            const d = delta(r.cur, r.prev);
            const goodUp = r.goodUp ?? true;
            const isPositive = (d > 0) === goodUp;
            const tone = d === 0 ? "text-muted-foreground" : isPositive ? "text-emerald-500" : "text-rose-500";
            const Icon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
            return (
              <div key={r.label} className="rounded-lg border border-border/40 bg-card/40 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{r.label}</div>
                <div className="mt-1 text-lg font-bold tabular-nums">{fmt(r.cur, r.isPct)}</div>
                <div className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">
                  {prevLabel}: {fmt(r.prev, r.isPct)}
                </div>
                <div className={cn("mt-1 inline-flex items-center gap-1 text-xs font-bold tabular-nums", tone)}>
                  <Icon className="h-3 w-3" />
                  {d >= 0 ? "+" : ""}
                  {d.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
