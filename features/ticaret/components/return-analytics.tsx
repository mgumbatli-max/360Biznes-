import Link from "next/link";
import { RotateCcw, AlertTriangle, TrendingDown, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getQaytarmaXulase, getTopReturnedProducts, getReturnReasonBuckets,
} from "@/features/ticaret/qaytarma-analiz-queries";
import { formatMoney, formatDate } from "@/lib/utils";
import { KpiCard } from "@/features/dashboard/components/kpi-card";

export async function ReturnAnalyticsPanel() {
  const [xulase, topProducts, reasons] = await Promise.all([
    getQaytarmaXulase(90),
    getTopReturnedProducts(90, 8),
    getReturnReasonBuckets(90),
  ]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={RotateCcw}
          label="Cəmi qaytarma (90 gün)"
          value={String(xulase.cemi_say)}
          subline={formatMoney(xulase.cemi_mebleg)}
          tone={xulase.cemi_say > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={RotateCcw}
          label="Bu ay"
          value={String(xulase.bu_ay_say)}
          subline={formatMoney(xulase.bu_ay_mebleg)}
        />
        <KpiCard
          icon={TrendingDown}
          label="Qaytarma faizi"
          value={`${xulase.qaytarma_faiz.toFixed(1)}%`}
          subline={`${xulase.satis_qaytarma_say} satış qaytarması`}
          tone={xulase.qaytarma_faiz > 5 ? "danger" : xulase.qaytarma_faiz > 2 ? "warning" : "success"}
        />
        <KpiCard
          icon={Package}
          label="Top problemli məhsul"
          value={topProducts[0]?.qaytarma_say.toString() ?? "0"}
          subline={topProducts[0]?.ad ?? "Heç bir qaytarma yoxdur"}
          tone={(topProducts[0]?.qaytarma_say ?? 0) > 3 ? "danger" : "neutral"}
        />
      </section>

      {/* 2 sütun: top məhsul + səbəblər */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Top problemli məhsullar */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
              Ən çox qaytarılan məhsullar (90 gün)
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Bu məhsulların keyfiyyəti və ya təsviri yoxlanmalıdır
            </p>
          </CardHeader>
          <CardContent className="space-y-1">
            {topProducts.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Qaytarma yoxdur 🎉</p>
            ) : (
              topProducts.map((p, i) => (
                <div
                  key={p.mehsul_id}
                  className="flex items-center gap-2 rounded-md border border-border/40 bg-card/40 px-2 py-1.5"
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded text-[10px] font-bold ${
                    i === 0 ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                      : i < 3 ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        : "bg-secondary"
                  }`}>
                    {i + 1}
                  </span>
                  <Link
                    href={`/anbar/mehsullar/${p.mehsul_id}`}
                    className="min-w-0 flex-1 hover:text-primary"
                  >
                    <div className="truncate text-xs font-semibold">{p.ad}</div>
                    {p.kod && (
                      <div className="text-[9.5px] text-muted-foreground">Kod: {p.kod}</div>
                    )}
                  </Link>
                  <div className="text-right">
                    <div className="text-xs font-bold tabular-nums">{p.qaytarma_say}× qaytarma</div>
                    <div className="text-[9.5px] tabular-nums text-muted-foreground">
                      {formatMoney(p.qaytarma_mebleg)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Səbəblər */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Qaytarma səbəbləri</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Hansı səbəbdən ən çox qaytarılır
            </p>
          </CardHeader>
          <CardContent className="space-y-1">
            {reasons.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Səbəb statistikası yoxdur</p>
            ) : (
              reasons.map((r) => {
                const total = reasons.reduce((s, x) => s + x.say, 0);
                const pct = total > 0 ? (r.say / total) * 100 : 0;
                return (
                  <div key={r.sebeb} className="space-y-0.5">
                    <div className="flex items-baseline justify-between text-[10.5px]">
                      <span className="min-w-0 flex-1 truncate font-medium">{r.sebeb}</span>
                      <span className="ml-2 tabular-nums text-muted-foreground">
                        {r.say} × {formatMoney(r.cemi_mebleg)}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-secondary/60">
                      <div
                        className="h-full bg-rose-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
