import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ListTodo,
  Coins,
  Clock,
  Wallet,
  Percent,
  Users,
} from "lucide-react";
import { Sparkline } from "@/components/ui/sparkline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatMoney, formatNumber } from "@/lib/utils";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { SalesChart } from "@/features/dashboard/components/sales-chart";
import { SalesExpenseChart } from "@/features/dashboard/components/sales-expense-chart";
import {
  getCeoKpis,
  getMonthlyComparison,
  getRecentSalesByDay,
  getSalesVsExpense30,
  getTodayCashFlow,
  getMyPendingWork,
  getDailyInsight,
} from "@/features/dashboard/queries";

function deltaPct(cur: number, prev: number): { val: number; dir: "up" | "down" } {
  if (prev === 0) return { val: cur > 0 ? 100 : 0, dir: cur >= 0 ? "up" : "down" };
  const v = ((cur - prev) / Math.abs(prev)) * 100;
  return { val: Math.abs(v), dir: v >= 0 ? "up" : "down" };
}

type HeroProps = {
  showInsight?: boolean;
  showKpi?: boolean;
  showCashflow?: boolean;
  showTapshiriq?: boolean;
  showCharts?: boolean;
};

export async function HeroSection({
  showInsight = true,
  showKpi = true,
  showCashflow = true,
  showTapshiriq = true,
  showCharts = true,
}: HeroProps = {}) {
  // İcazə olmayan bölmələrin sorğularını çağırmırıq — DB yüklənmir.
  const needCeo = showKpi || showCashflow;
  const needMonthly = showKpi;
  const needSales7d = showKpi || showCharts;
  const needSalesVsExp = showKpi || showCharts;
  const needCashflow = showCashflow;
  const needMyWork = showTapshiriq;
  const needInsight = showInsight;

  const [ceo, monthly, sales7d, salesVsExp, cashflow, myWork, insight] = await Promise.all([
    needCeo ? getCeoKpis() : Promise.resolve(null),
    needMonthly ? getMonthlyComparison() : Promise.resolve(null),
    needSales7d ? getRecentSalesByDay(30) : Promise.resolve([]),
    needSalesVsExp ? getSalesVsExpense30() : Promise.resolve([]),
    needCashflow ? getTodayCashFlow() : Promise.resolve(null),
    needMyWork ? getMyPendingWork() : Promise.resolve(null),
    needInsight ? getDailyInsight() : Promise.resolve(null),
  ]);

  const revD = monthly ? deltaPct(monthly.current.revenue, monthly.previous.revenue) : { val: 0, dir: "up" as const };
  const expD = monthly ? deltaPct(monthly.current.expense, monthly.previous.expense) : { val: 0, dir: "up" as const };
  const prfD = monthly ? deltaPct(monthly.current.profit, monthly.previous.profit) : { val: 0, dir: "up" as const };
  const cusD = monthly ? deltaPct(monthly.current.newCustomers, monthly.previous.newCustomers) : { val: 0, dir: "up" as const };

  const revSpark = sales7d.map((d) => d.amount);
  const expSpark = salesVsExp.map((d) => d.xerc);
  const profitSpark = salesVsExp.map((d) => d.satis - d.xerc);
  const countSpark = sales7d.map((d) => d.count);
  const revUp = revD.dir === "up";

  return (
    <>
      {showInsight && insight && (
        <div
          className={cn(
            "group relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 shadow-sm transition-all hover:shadow-md",
            insight.tone === "success" ? "border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent" :
            insight.tone === "warning" ? "border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent" :
            insight.tone === "danger" ? "border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent" :
            "border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent",
          )}
        >
          <span
            className={cn(
              "grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-xl shadow-sm transition-transform duration-200 group-hover:scale-110",
              insight.tone === "success" ? "bg-emerald-500/20" :
              insight.tone === "warning" ? "bg-amber-500/20" :
              insight.tone === "danger" ? "bg-rose-500/20" :
              "bg-primary/20",
            )}
          >
            {insight.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Günün analitikası
            </div>
            <div className="mt-0.5 text-sm font-medium leading-snug">{insight.text}</div>
          </div>
        </div>
      )}

      {showKpi && monthly && ceo && cashflow && (
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link
          href="/hesabatlar"
          className="group relative col-span-1 overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg lg:col-span-2"
          style={{
            backgroundImage:
              "radial-gradient(120% 80% at 100% 0%, hsl(142 76% 45% / 0.15), transparent 60%), radial-gradient(60% 60% at 0% 100%, hsl(var(--primary) / 0.12), transparent 60%)",
          }}
        >
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-success/15 text-success">
                  <TrendingUp className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Bu ayın gəliri
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    revUp ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                  )}
                >
                  {revUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {revD.val.toFixed(0)}%
                </span>
              </div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight tabular-nums leading-none text-success break-words">
                {formatMoney(monthly.current.revenue)}
              </div>
              <div className="text-xs text-muted-foreground">
                Keçən ay: <span className="tabular-nums font-medium text-foreground/80">{formatMoney(monthly.previous.revenue)}</span>
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                Son 30 günün gündəlik trendi ↓
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-light/70 transition group-hover:gap-2.5">
              Hesabatlara keç
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </div>
          <div className="relative z-0 mt-2 -mx-2">
            <Sparkline data={revSpark} width={680} height={64} color="hsl(142 76% 45%)" filled showLast />
          </div>
        </Link>

        <div className="col-span-1 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Bu gün
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Real-time
            </span>
          </div>

          <Link href="/ticaret/satislar" className="group/r flex items-end justify-between gap-2 rounded-lg px-1 py-1 transition hover:bg-secondary/40">
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">Satış</div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">{formatMoney(ceo.todaySalesAmount)}</div>
              <div className="text-[11px] text-muted-foreground">{ceo.todaySalesCount} sifariş</div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover/r:translate-x-0.5 group-hover/r:text-primary" />
          </Link>

          <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
            <div className="rounded-lg bg-secondary/40 px-2.5 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Net axın</div>
              <div className={cn("mt-0.5 text-base font-bold tabular-nums", cashflow.net >= 0 ? "text-success" : "text-danger")}>
                {cashflow.net >= 0 ? "+" : ""}{formatMoney(cashflow.net)}
              </div>
            </div>
            <Link
              href="/tapshiriqlar"
              className={cn(
                "rounded-lg px-2.5 py-2 transition hover:bg-secondary",
                ceo.openTasks > 0 ? "bg-warning/10" : "bg-secondary/40"
              )}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Açıq tapşırıq</div>
              <div className={cn("mt-0.5 text-base font-bold tabular-nums", ceo.openTasks > 0 ? "text-warning" : "text-foreground")}>
                {formatNumber(ceo.openTasks)}
              </div>
            </Link>
            <Link
              href="/anbar/mehsullar?stok_status=az"
              className={cn(
                "rounded-lg px-2.5 py-2 transition hover:bg-secondary",
                ceo.lowStockCount > 0 ? "bg-danger/10" : "bg-secondary/40"
              )}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Aşağı stok</div>
              <div className={cn("mt-0.5 text-base font-bold tabular-nums", ceo.lowStockCount > 0 ? "text-danger" : "text-foreground")}>
                {formatNumber(ceo.lowStockCount)}
              </div>
            </Link>
            <Link href="/elaqe" className="rounded-lg bg-secondary/40 px-2.5 py-2 transition hover:bg-secondary">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Müştəri</div>
              <div className="mt-0.5 text-base font-bold tabular-nums">{formatNumber(ceo.activeCustomers)}</div>
            </Link>
          </div>
        </div>
      </section>
      )}

      {showKpi && monthly && ceo && (
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          icon={Wallet}
          label="Xərc (bu ay)"
          value={formatMoney(monthly.current.expense)}
          subline={`Keçən: ${formatMoney(monthly.previous.expense)}`}
          trend={{ dir: expD.dir, label: `${expD.val.toFixed(0)}%` }}
          tone="warning"
          href="/maliyye/xercler"
          sparkline={expSpark}
        />
        <KpiCard
          icon={Percent}
          label="Mənfəət (bu ay)"
          value={formatMoney(monthly.current.profit)}
          subline={`${ceo.netProfitPct.toFixed(1)}% marja · keçən: ${formatMoney(monthly.previous.profit)}`}
          trend={{ dir: prfD.dir, label: `${prfD.val.toFixed(0)}%` }}
          tone={ceo.netProfitPct >= 0 ? "success" : "danger"}
          href="/maliyye/hesabat"
          sparkline={profitSpark}
        />
        <KpiCard
          icon={Users}
          label="Yeni müştəri"
          value={formatNumber(monthly.current.newCustomers)}
          subline={`Keçən: ${formatNumber(monthly.previous.newCustomers)} · aktiv: ${formatNumber(ceo.activeCustomers)}`}
          trend={{ dir: cusD.dir, label: `${cusD.val.toFixed(0)}%` }}
          href="/elaqe"
          sparkline={countSpark}
        />
      </section>
      )}

      {(showCashflow || showTapshiriq) && (
      <section className={cn(
        "grid grid-cols-1 gap-4",
        showCashflow && showTapshiriq ? "lg:grid-cols-2" : "",
      )}>
        {showCashflow && cashflow && (
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4 text-pink-500" /> Bu gün pul axını
            </CardTitle>
            <Link href="/hesabatlar/pul" className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
              Detal <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {(() => {
              const max = Math.max(cashflow.daxil, cashflow.xaric, 1);
              const inPct = (cashflow.daxil / max) * 100;
              const outPct = (cashflow.xaric / max) * 100;
              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Mədaxil</div>
                      <div className="mt-1 text-xl font-bold tabular-nums text-emerald-500">{formatMoney(cashflow.daxil)}</div>
                    </div>
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Məxaric</div>
                      <div className="mt-1 text-xl font-bold tabular-nums text-rose-500">{formatMoney(cashflow.xaric)}</div>
                    </div>
                    <div className={cn(
                      "rounded-lg border p-3",
                      cashflow.net >= 0 ? "border-primary/20 bg-primary/5" : "border-rose-500/20 bg-rose-500/5",
                    )}>
                      <div className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        cashflow.net >= 0 ? "text-primary" : "text-rose-500",
                      )}>Net</div>
                      <div className={cn(
                        "mt-1 text-xl font-bold tabular-nums",
                        cashflow.net >= 0 ? "text-primary" : "text-rose-500",
                      )}>
                        {cashflow.net >= 0 ? "+" : ""}{formatMoney(cashflow.net)}
                      </div>
                    </div>
                  </div>

                  {/* Visual proportional bars — daxil vs xaric */}
                  <div className="mt-4 space-y-2">
                    <div>
                      <div className="mb-0.5 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                        <span>Mədaxil</span>
                        <span>{inPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-emerald-500/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-700 ease-out"
                          style={{ width: `${inPct}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-0.5 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                        <span>Məxaric</span>
                        <span>{outPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-rose-500/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-[width] duration-700 ease-out"
                          style={{ width: `${outPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-right text-[10.5px] text-muted-foreground">
                    {cashflow.emeliyyat_say} əməliyyat bu gün
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
        )}

        {showTapshiriq && myWork && (
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="h-4 w-4 text-primary" /> Mənim işim
            </CardTitle>
            <Link href="/tapshiriqlar" className="inline-flex items-center gap-1 text-xs font-medium text-primary-light hover:underline">
              Hamısı <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {(() => {
              // Effektivlik faizi — açıq tapşırıqlardan neçə faiz gecikməyib
              const onTime = Math.max(0, myWork.my_open_tasks - myWork.my_overdue);
              const ratio = myWork.my_open_tasks > 0 ? onTime / myWork.my_open_tasks : 1;
              const pct = Math.round(ratio * 100);
              const tone =
                myWork.my_open_tasks === 0 ? "emerald" :
                pct >= 90 ? "emerald" :
                pct >= 60 ? "amber" :
                "rose";
              const toneClass = {
                emerald: { ring: "text-emerald-500", track: "text-emerald-500/10", label: "Möhtəşəm" },
                amber:   { ring: "text-amber-500",   track: "text-amber-500/10",   label: "Diqqətli ol" },
                rose:    { ring: "text-rose-500",    track: "text-rose-500/10",    label: "Düz toxun!" },
              }[tone];

              // SVG progress ring (44 rad)
              const RADIUS = 22;
              const CIRC = 2 * Math.PI * RADIUS;
              const offset = CIRC * (1 - ratio);

              return (
                <div className="flex items-center gap-4">
                  {/* Effektivlik ringi */}
                  <div className="relative h-16 w-16 flex-shrink-0">
                    <svg className="h-16 w-16 -rotate-90" viewBox="0 0 52 52">
                      <circle cx="26" cy="26" r={RADIUS} fill="none" strokeWidth="4" className={toneClass.track} stroke="currentColor" />
                      <circle
                        cx="26" cy="26" r={RADIUS}
                        fill="none" strokeWidth="4" strokeLinecap="round"
                        className={cn("transition-[stroke-dashoffset] duration-700 ease-out", toneClass.ring)}
                        stroke="currentColor"
                        strokeDasharray={CIRC}
                        strokeDashoffset={offset}
                      />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center">
                      <div className={cn("text-xs font-bold tabular-nums", toneClass.ring)}>
                        {pct}%
                      </div>
                    </div>
                  </div>
                  <div className="grid flex-1 grid-cols-3 gap-1.5 text-center text-xs">
                    <Link href="/tapshiriqlar?scope=menim&status=baxilir,planlasdirilan" className="rounded-md bg-primary/10 p-1.5 transition hover:bg-primary/20">
                      <div className="text-lg font-bold tabular-nums text-primary">{myWork.my_open_tasks}</div>
                      <div className="text-[10px] text-muted-foreground">açıq</div>
                    </Link>
                    <Link href="/tapshiriqlar?scope=menim&sort=xatirlatma" className="rounded-md bg-amber-500/10 p-1.5 transition hover:bg-amber-500/20">
                      <div className="text-lg font-bold tabular-nums text-amber-500">{myWork.my_today_reminders}</div>
                      <div className="text-[10px] text-muted-foreground">xatırlatma</div>
                    </Link>
                    <Link
                      href="/tapshiriqlar?scope=menim&overdue=1"
                      className={cn(
                        "rounded-md p-1.5 transition",
                        myWork.my_overdue > 0 ? "bg-rose-500/10 hover:bg-rose-500/20" : "bg-emerald-500/10 hover:bg-emerald-500/20",
                      )}
                    >
                      <div className={cn(
                        "text-lg font-bold tabular-nums",
                        myWork.my_overdue > 0 ? "text-rose-500" : "text-emerald-500",
                      )}>{myWork.my_overdue}</div>
                      <div className="text-[10px] text-muted-foreground">gecikmiş</div>
                    </Link>
                  </div>
                </div>
              );
            })()}

            {myWork.next_tasks.length === 0 ? (
              <p className="mt-3 py-3 text-center text-xs text-muted-foreground">Tapşırıq yoxdur — möhtəşəm! 🎉</p>
            ) : (
              <ul className="mt-3 space-y-0.5 border-t border-border/40 pt-2">
                {myWork.next_tasks.slice(0, 4).map((t) => {
                  const isOverdue = t.deadline && t.deadline < new Date();
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/tapshiriqlar/${t.id}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition hover:bg-secondary/40"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          {t.prioritet === "tecili" ? <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500 ring-2 ring-rose-500/30" /> :
                            t.prioritet === "yuksek" ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" /> :
                            <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400/60" />}
                          <span className={cn("truncate font-medium", isOverdue && "text-rose-500")}>{t.basliq}</span>
                        </div>
                        {t.deadline && (
                          <span className={cn(
                            "shrink-0 text-[10px]",
                            isOverdue ? "font-bold text-rose-500" : "text-muted-foreground",
                          )}>
                            <Clock className="mr-0.5 inline h-2.5 w-2.5" />
                            {new Date(t.deadline).toLocaleDateString("az-AZ", { day: "2-digit", month: "short" })}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        )}
      </section>
      )}

      {showCharts && (
      <>
        <section>
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Son 30 gün satış</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Gündəlik ümumi satış məbləği</p>
              </div>
              <Link href="/hesabatlar" className="inline-flex items-center gap-1 text-xs font-medium text-primary-light hover:underline">
                Hesabatlar <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              <SalesChart data={sales7d} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Satış vs Xərc (30 gün)</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Gündəlik müqayisə</p>
            </CardHeader>
            <CardContent>
              <SalesExpenseChart data={salesVsExp} />
            </CardContent>
          </Card>
        </section>
      </>
      )}
    </>
  );
}
