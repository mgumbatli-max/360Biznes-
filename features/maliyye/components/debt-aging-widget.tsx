import { TrendingDown, AlertTriangle, Clock, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Bucket = { label: string; amount: number; count: number };

type Props = {
  buckets: Bucket[];
  totalAmount: number;
  title?: string;
};

const BUCKET_TONE: Record<number, string> = {
  0: "bg-emerald-500/15 border-emerald-500/30 text-emerald-600",
  1: "bg-amber-500/15 border-amber-500/30 text-amber-600",
  2: "bg-orange-500/15 border-orange-500/30 text-orange-600",
  3: "bg-rose-500/15 border-rose-500/30 text-rose-600",
  4: "bg-rose-500/20 border-rose-500/40 text-rose-700",
};

function fmt(n: number) {
  return new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 0 }).format(n) + " ₼";
}

export function DebtAgingWidget({ buckets, totalAmount, title = "Borc müddəti analizi" }: Props) {
  const max = Math.max(...buckets.map((b) => b.amount), 1);

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            {title}
          </span>
          <span className="text-sm font-bold tabular-nums">{fmt(totalAmount)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {buckets.map((b, i) => {
          const pct = (b.amount / max) * 100;
          const totalPct = totalAmount > 0 ? (b.amount / totalAmount) * 100 : 0;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-semibold", BUCKET_TONE[i] ?? BUCKET_TONE[0])}>
                  {i === 0 ? <Calendar className="h-3 w-3" /> : i >= 3 ? <AlertTriangle className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {b.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">{b.count} qaimə</span>
                  <span className="font-bold tabular-nums">{fmt(b.amount)}</span>
                  <span className="w-10 text-right text-[10px] text-muted-foreground/80 tabular-nums">{totalPct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", BUCKET_TONE[i]?.split(" ")[0] ?? "bg-emerald-500/15")}
                  style={{
                    width: `${pct}%`,
                    background:
                      i === 0 ? "hsl(160 84% 39% / 0.6)" :
                      i === 1 ? "hsl(38 92% 50% / 0.6)" :
                      i === 2 ? "hsl(24 95% 53% / 0.6)" :
                      "hsl(0 84% 60% / 0.7)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
