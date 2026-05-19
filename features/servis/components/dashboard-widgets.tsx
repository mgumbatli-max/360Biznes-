import Link from "next/link";
import { Clock, AlertOctagon, TrendingUp, Star } from "lucide-react";
import { formatMoney } from "@/lib/utils";

export function ServisDashboardWidgets({
  cycle_avg,
  sla_breach,
  month_profit,
  rating_avg,
  rating_count,
}: {
  cycle_avg: number;
  sla_breach: number;
  month_profit: number;
  rating_avg: number;
  rating_count: number;
}) {
  const stars = Math.round(rating_avg);
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="glass rounded-lg border bg-card/40 p-3">
        <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Həftə cycle (gün)
        </div>
        <div className="mt-1 text-xl font-bold tabular-nums text-violet-300">{cycle_avg}</div>
      </div>
      <Link
        href="/servis/sla"
        className="glass block rounded-lg border bg-card/40 p-3 transition hover:border-rose-400/60"
      >
        <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          <AlertOctagon className="h-3.5 w-3.5" /> SLA pozğunluq
        </div>
        <div className="mt-1 text-xl font-bold tabular-nums text-rose-400">{sla_breach}</div>
      </Link>
      <div className="glass rounded-lg border bg-card/40 p-3">
        <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" /> Bu ay net mənfəət
        </div>
        <div
          className={`mt-1 text-xl font-bold tabular-nums ${
            month_profit > 0 ? "text-emerald-400" : month_profit < 0 ? "text-rose-400" : ""
          }`}
        >
          {formatMoney(month_profit)}
        </div>
      </div>
      <div className="glass rounded-lg border bg-card/40 p-3">
        <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          <Star className="h-3.5 w-3.5" /> Müştəri reytinqi
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-xl font-bold tabular-nums">{rating_avg || "—"}</span>
          <span className="text-amber-400 tabular-nums" aria-hidden>
            {"★".repeat(stars)}
            <span className="text-muted-foreground">{"☆".repeat(Math.max(0, 5 - stars))}</span>
          </span>
          {rating_count > 0 && <span className="text-[10px] text-muted-foreground">({rating_count})</span>}
        </div>
      </div>
    </section>
  );
}
