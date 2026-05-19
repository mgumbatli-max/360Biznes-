import { TrendingUp, Target, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BonusHesablama } from "@/features/iscilier/bonus-calc";
import { formatMoney } from "@/lib/utils";

/**
 * Bonus hesablamasını göstərən pure presentation komponenti.
 * Data parent tərəfindən fetch olunub ötürülür.
 */
export function BonusLiveCalc({ result }: { result: BonusHesablama | null }) {
  if (!result) {
    return (
      <Card className="glass border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          İşçi tapılmadı.
        </CardContent>
      </Card>
    );
  }

  if (result.kateqoriyalar.length === 0 && result.pool_mebleg === 0) {
    return (
      <Card className="glass border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Bonus profili konfiqurə edilməyib. Yuxarıdan əlavə et.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-emerald-500/30 bg-emerald-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          Bu ay bonus hesabı — live
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Pool: <strong className="text-foreground">{formatMoney(result.pool_mebleg)}</strong> ·
          Qazanıldı: <strong className="text-emerald-600 dark:text-emerald-400">{formatMoney(result.qazanilan_cemi)}</strong>
          {result.paylanmayan_mebleg > 0 && (
            <> · Paylanmayan: <strong className="text-muted-foreground">{formatMoney(result.paylanmayan_mebleg)}</strong></>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {result.kateqoriyalar.map((k) => {
          const pct = Math.min(100, Math.round(k.nailiyyet_faiz));
          const tone =
            pct >= 100 ? "text-emerald-600 dark:text-emerald-400"
              : pct >= 70 ? "text-amber-600 dark:text-amber-400"
                : "text-rose-600 dark:text-rose-400";
          const Icon = pct >= 100 ? CheckCircle2 : pct >= 70 ? Target : AlertTriangle;
          return (
            <div key={k.kateqoriya} className="rounded-md border border-border/40 bg-card/50 p-2.5">
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-bold">{k.label}</span>
                    <Badge variant="outline" className="text-[9.5px]">
                      Pay: {formatMoney(k.pay_meblegh)}
                    </Badge>
                    <span className={`ml-auto text-base font-bold tabular-nums ${tone}`}>
                      {formatMoney(k.qazanilan_mebleg)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                      <div
                        className={`h-full transition-all ${
                          pct >= 100 ? "bg-emerald-500"
                            : pct >= 70 ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-[10.5px] font-bold tabular-nums ${tone}`}>{pct}%</span>
                  </div>

                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Faktiki: <span className="tabular-nums">{k.hedef_vahid === "mebleg" ? formatMoney(k.faktiki) : `${k.faktiki.toFixed(1)}%`}</span>
                    {" / "}
                    Hədəf: <span className="tabular-nums">{k.hedef_vahid === "mebleg" ? formatMoney(k.hedef) : `${k.hedef}%`}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
