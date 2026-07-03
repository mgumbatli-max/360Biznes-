import { Trophy, Medal, Award, Wrench, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";

type Row = {
  texnik_id: string | null;
  ad_soyad: string;
  email: string;
  count: number;
  revenue: number;
  avg: number;
};

function fmt(n: number) {
  // Deterministik (Intl.NumberFormat ICU Node≠brauzer → hidratasiya #418).
  return formatNumber(Math.round(n), 0) + " ₼";
}

const RANK_ICON = [Trophy, Medal, Award];
const RANK_COLOR = [
  "bg-amber-400/15 text-amber-500 border-amber-500/30",
  "bg-slate-300/15 text-slate-500 border-slate-400/30",
  "bg-orange-400/15 text-orange-500 border-orange-500/30",
];

export function TechnicianLeaderboard({ rows, title = "Texnik liderbordu (30 gün)" }: { rows: Row[]; title?: string }) {
  if (rows.length === 0) {
    return (
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            <Wrench className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            Bu dövrdə texnikların məlumatı yoxdur
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1);

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-amber-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {rows.map((r, i) => {
            const Icon = i < 3 ? RANK_ICON[i] : null;
            const rankCls = i < 3 ? RANK_COLOR[i] : "bg-secondary/40 text-muted-foreground border-border";
            const pct = (r.revenue / maxRevenue) * 100;

            return (
              <div key={r.texnik_id ?? i} className="group flex items-center gap-3">
                {/* Rank badge */}
                <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-bold transition group-hover:scale-105", rankCls)}>
                  {Icon ? <Icon className="h-4 w-4" /> : <span className="text-sm">{i + 1}</span>}
                </div>

                {/* Name and stats */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{r.ad_soyad}</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{fmt(r.revenue)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px]">
                        <Wrench className="mr-1 h-2.5 w-2.5" />
                        {r.count} servis
                      </Badge>
                      <span>orta: {fmt(r.avg)}</span>
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary/60">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: i === 0
                          ? "linear-gradient(90deg, hsl(43 96% 56%), hsl(38 92% 50%))"
                          : i === 1
                          ? "linear-gradient(90deg, hsl(220 13% 70%), hsl(220 13% 56%))"
                          : i === 2
                          ? "linear-gradient(90deg, hsl(24 95% 53%), hsl(20 90% 48%))"
                          : "hsl(var(--primary) / 0.5)",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-[10.5px]">
          <span className="font-semibold text-muted-foreground">CƏMİ</span>
          <span className="inline-flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span className="font-bold tabular-nums">
              {fmt(rows.reduce((s, r) => s + r.revenue, 0))}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-bold tabular-nums">{rows.reduce((s, r) => s + r.count, 0)} servis</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
