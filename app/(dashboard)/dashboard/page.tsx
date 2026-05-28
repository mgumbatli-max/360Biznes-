import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Wallet,
  ListTodo,
  Percent,
  ScanLine,
  ShoppingCart,
  Wrench,
  FileBarChart,
  PlusCircle,
  UserPlus,
  Activity,
  CircleDollarSign,
  Trophy,
  Receipt,
  Bell,
  ShieldAlert,
  Coins,
  Clock,
} from "lucide-react";
import { Sparkline } from "@/components/ui/sparkline";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney, formatNumber } from "@/lib/utils";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { SalesChart } from "@/features/dashboard/components/sales-chart";
import { LowStockPanel } from "@/features/dashboard/components/low-stock-panel";
import { BirthdayWidget } from "@/features/dashboard/components/birthday-widget";
import { DemoBanner } from "@/features/dashboard/components/demo-banner";
import { AutoRefresh } from "@/features/audit-log/components/auto-refresh";
import { SalesExpenseChart } from "@/features/dashboard/components/sales-expense-chart";
import {
  getDashboardKpis,
  getRecentSalesByDay,
  getLowStockItems,
  getCeoKpis,
  getMonthlyComparison,
  getTopProducts,
  getTopSellers,
  getTopCustomers,
  getTopPlatforms,
  getRecentSales,
  getRecentActivity,
  getCriticalAlertsForDash,
  getSalesVsExpense30,
  getTodayCashFlow,
  getMyPendingWork,
  getDailyInsight,
} from "@/features/dashboard/queries";
import { getDashboardActivityFeed } from "@/features/dashboard/recent-activity-queries";
import { RecentActivityWidget } from "@/features/dashboard/components/recent-activity-widget";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function deltaPct(cur: number, prev: number): { val: number; dir: "up" | "down" } {
  if (prev === 0) return { val: cur > 0 ? 100 : 0, dir: cur >= 0 ? "up" : "down" };
  const v = ((cur - prev) / Math.abs(prev)) * 100;
  return { val: Math.abs(v), dir: v >= 0 ? "up" : "down" };
}

const activityIconFor = (tip: string) => {
  switch (tip) {
    case "satis":
      return ShoppingCart;
    case "kassa":
      return CircleDollarSign;
    case "xeberdar":
      return Bell;
    case "servis":
      return Wrench;
    default:
      return Activity;
  }
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user;

  const [
    kpisLegacy,
    ceo,
    sales7d,
    lowStock,
    monthly,
    topProducts,
    topSellers,
    topCustomers,
    topPlatforms,
    recentSales,
    recentActivity,
    bizFeed,
    critical,
    salesVsExp,
    cashflow,
    myWork,
    insight,
  ] = await Promise.all([
    getDashboardKpis(),
    getCeoKpis(),
    getRecentSalesByDay(30),
    getLowStockItems(8),
    getMonthlyComparison(),
    getTopProducts(5),
    getTopSellers(5),
    getTopCustomers(5),
    getTopPlatforms(5),
    getRecentSales(5),
    getRecentActivity(15),
    getDashboardActivityFeed(12).catch(() => []),
    getCriticalAlertsForDash(5),
    getSalesVsExpense30(),
    getTodayCashFlow(),
    getMyPendingWork(),
    getDailyInsight(),
  ]);

  const revD = deltaPct(monthly.current.revenue, monthly.previous.revenue);
  const expD = deltaPct(monthly.current.expense, monthly.previous.expense);
  const prfD = deltaPct(monthly.current.profit, monthly.previous.profit);
  const cusD = deltaPct(monthly.current.newCustomers, monthly.previous.newCustomers);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <DemoBanner
        abuneBitme={u.abune_bitme}
        abuneStatus={u.abune_status}
        novu={u.abune_status === "sinaq" ? "sinaq" : null}
      />

      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1 animate-fade-up">
            {(() => {
              const hour = new Date().getHours();
              const greet =
                hour < 6 ? "Sakit gecələr" :
                hour < 12 ? "Sabahın xeyir" :
                hour < 17 ? "Gününüz xeyir" :
                hour < 22 ? "Axşamın xeyir" :
                "Gecəniz xeyirə qalsın";
              return (
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{greet}</p>
              );
            })()}
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="gradient-text">{u.ad_soyad.split(" ")[0]}</span>
              <span className="ml-2 text-foreground">👋</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("az-AZ", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              <span className="ml-2 text-muted-foreground/60">·</span>
              <span className="ml-2 text-muted-foreground/80">{u.sahibkar_ad}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AutoRefresh />
            <Button asChild size="sm" variant="outline">
              <Link href="/nezaret-merkezi">
                <ShieldAlert className="h-3.5 w-3.5" /> Nəzarət
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/hesabatlar">
                <FileBarChart className="h-3.5 w-3.5" /> Hesabat
              </Link>
            </Button>
          </div>
        </div>

        {/* Primary quick actions — flat row, equal weight */}
        <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
          <Button asChild size="sm" variant="default" className="font-semibold">
            <Link href="/pos" target="_blank" rel="noopener">
              <ScanLine className="h-3.5 w-3.5" /> POS aç
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/ticaret/satislar/yeni">
              <PlusCircle className="h-3.5 w-3.5" /> Yeni satış
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/anbar/satinalma">
              <Receipt className="h-3.5 w-3.5" /> Yeni alış
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/servis">
              <Wrench className="h-3.5 w-3.5" /> Yeni servis
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/elaqe">
              <UserPlus className="h-3.5 w-3.5" /> Yeni müştəri
            </Link>
          </Button>
        </div>
      </header>

      {/* Smart daily insight — dynamic message */}
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
          insight.tone === "success" ? "border-emerald-500/30 bg-emerald-500/5" :
          insight.tone === "warning" ? "border-amber-500/30 bg-amber-500/5" :
          insight.tone === "danger" ? "border-rose-500/30 bg-rose-500/5" :
          "border-primary/30 bg-primary/5"
        }`}
      >
        <span className="text-2xl">{insight.emoji}</span>
        <span className="text-sm font-medium">{insight.text}</span>
      </div>

      {/* BENTO: BIG hero metric (Gəlir) + Today snapshot sidekick */}
      {(() => {
        const revSpark = sales7d.map((d) => d.amount);
        const expSpark = salesVsExp.map((d) => d.xerc);
        const profitSpark = salesVsExp.map((d) => d.satis - d.xerc);
        const countSpark = sales7d.map((d) => d.count);
        const revUp = revD.dir === "up";
        return (
          <>
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* BIG HERO: Bu ay gəlir + Sparkline */}
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
                    <div className="text-5xl font-bold tracking-tight tabular-nums leading-none text-success">
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

              {/* SIDEKICK: Bu gün operativ snapshot */}
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
                    href="/anbar/mehsullar?stok=az"
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

            {/* 3 kiçik KPI: Xərc, Mənfəət, Yeni müştəri (sparkline ilə) */}
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
                href="/maliyye/hesabatlar"
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
          </>
        );
      })()}

      {/* Today's cash flow + My pending work — 2 wide widgets */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cash flow today */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4 text-pink-500" />
              Bu gün pul axını
            </CardTitle>
            <Link href="/hesabatlar/pul" className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
              Detal <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Mədaxil</div>
                <div className="mt-1 text-xl font-bold tabular-nums text-emerald-500">{formatMoney(cashflow.daxil)}</div>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Məxaric</div>
                <div className="mt-1 text-xl font-bold tabular-nums text-rose-500">{formatMoney(cashflow.xaric)}</div>
              </div>
              <div className={`rounded-lg border p-3 ${cashflow.net >= 0 ? "border-primary/20 bg-primary/5" : "border-rose-500/20 bg-rose-500/5"}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${cashflow.net >= 0 ? "text-primary" : "text-rose-500"}`}>Net</div>
                <div className={`mt-1 text-xl font-bold tabular-nums ${cashflow.net >= 0 ? "text-primary" : "text-rose-500"}`}>
                  {cashflow.net >= 0 ? "+" : ""}{formatMoney(cashflow.net)}
                </div>
              </div>
            </div>
            <div className="mt-2 text-right text-[10.5px] text-muted-foreground">
              {cashflow.emeliyyat_say} əməliyyat bu gün
            </div>
          </CardContent>
        </Card>

        {/* My pending work */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="h-4 w-4 text-primary" />
              Mənim işim
            </CardTitle>
            <Link href="/tapshiriqlar" className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
              Hamısı <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="mb-2 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-primary/10 p-1.5">
                <div className="text-lg font-bold tabular-nums text-primary">{myWork.my_open_tasks}</div>
                <div className="text-[10px] text-muted-foreground">açıq tapşırıq</div>
              </div>
              <div className="rounded-md bg-amber-500/10 p-1.5">
                <div className="text-lg font-bold tabular-nums text-amber-500">{myWork.my_today_reminders}</div>
                <div className="text-[10px] text-muted-foreground">xatırlatma</div>
              </div>
              <div className={`rounded-md p-1.5 ${myWork.my_overdue > 0 ? "bg-rose-500/10" : "bg-emerald-500/10"}`}>
                <div className={`text-lg font-bold tabular-nums ${myWork.my_overdue > 0 ? "text-rose-500" : "text-emerald-500"}`}>{myWork.my_overdue}</div>
                <div className="text-[10px] text-muted-foreground">gecikmiş</div>
              </div>
            </div>
            {myWork.next_tasks.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">Tapşırıq yoxdur — möhtəşəm! 🎉</p>
            ) : (
              <ul className="space-y-1">
                {myWork.next_tasks.slice(0, 4).map((t) => {
                  const isOverdue = t.deadline && t.deadline < new Date();
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/tapshiriqlar/${t.id}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-secondary/30"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          {t.prioritet === "tecili" ? <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" /> :
                            t.prioritet === "yuksek" ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" /> :
                            <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />}
                          <span className="truncate font-medium">{t.basliq}</span>
                        </div>
                        {t.deadline && (
                          <span className={`shrink-0 text-[10px] ${isOverdue ? "text-rose-500 font-bold" : "text-muted-foreground"}`}>
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
      </section>

      {/* Critical attention card */}
      {critical.length > 0 && (
        <Card className="glass border-rose-500/30 bg-rose-500/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Diqqət lazımdır
              <Badge variant="destructive" className="h-5">{critical.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-1">
            {critical.map((a) => (
              <Link key={a.id} href={`/xeberdarliqlar/${a.id}`}
                className="flex items-center justify-between rounded-md border border-rose-500/15 bg-background/40 px-3 py-2 text-sm transition hover:border-rose-500/40">
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.basliq}</div>
                  <div className="text-xs text-muted-foreground">{a.kateqoriya_ad}</div>
                </div>
                <Badge variant={a.seviyye === "kritik" ? "destructive" : "secondary"} className="h-5 text-[10px]">
                  {a.seviyye}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts row 1 — full-width sales chart */}
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

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Satış vs Xərc (30 gün)</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Gündəlik müqayisə</p>
          </CardHeader>
          <CardContent>
            <SalesExpenseChart data={salesVsExp} />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Aşağı stok</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Top 8 kritik məhsul</p>
            </CardHeader>
            <CardContent>
              <LowStockPanel rows={lowStock} />
            </CardContent>
          </Card>
          {/* Doğum günü widget — bu gün + 7 gün */}
          <BirthdayWidget />
        </div>
      </section>

      {/* Top 5 BENTO — 4 widget bir blokda */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">Top 5 — bu ay</h2>
          <span className="text-[10.5px] text-muted-foreground">cari ay üzrə</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <TopList
            title="Top məhsul"
            icon={Package}
            tone="info"
            items={topProducts.map((p) => ({
              key: p.ad,
              name: p.ad,
              sub: `${formatNumber(p.miqdar, 1)} ədəd`,
              value: formatMoney(p.mebleg),
            }))}
            empty="Hələ satılan məhsul yoxdur"
            href="/anbar/mehsullar"
          />
          <TopList
            title="Top satıcı"
            icon={Trophy}
            tone="warning"
            items={topSellers.map((s) => ({
              key: s.id || s.ad_soyad || "",
              name: s.ad_soyad || "—",
              sub: `${s.sifaris_say} sifariş`,
              value: formatMoney(s.cemi),
            }))}
            empty="Bu ay satıcı statistikası yoxdur"
            href="/team"
          />
          <TopList
            title="Top alıcı"
            icon={Users}
            tone="neutral"
            items={topCustomers.map((c) => ({
              key: c.id,
              name: c.ad,
              sub: `${c.sifaris_say} alış${c.telefon ? ` · ${c.telefon}` : ""}`,
              value: formatMoney(c.cemi),
              href: `/elaqe/musteriler/${c.id}`,
            }))}
            empty="Hələ alıcı yoxdur"
            href="/elaqe"
          />
          <TopList
            title="Top platforma"
            icon={Activity}
            tone="success"
            items={topPlatforms.map((p) => ({
              key: p.platform,
              name: p.platform,
              sub: `${p.sifaris_say} sifariş`,
              value: formatMoney(p.cemi),
            }))}
            empty="Hələ satış kanalı yoxdur"
            href="/marketplace"
          />
        </div>
      </section>

      {/* Activity feed (1) + Recent sales (2) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Son 5 satış</CardTitle>
            <Link href="/ticaret/satislar" className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
              Hamısı <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Hələ satış yoxdur.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <th className="px-2 py-2 text-left font-medium">Nömrə</th>
                      <th className="px-2 py-2 text-left font-medium">Müştəri</th>
                      <th className="px-2 py-2 text-left font-medium">Tarix</th>
                      <th className="px-2 py-2 text-right font-medium">Məbləğ</th>
                      <th className="px-2 py-2 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((s) => (
                      <tr key={s.id} className="border-b border-border/30 last:border-0">
                        <td className="px-2 py-2 font-mono text-xs">
                          <Link href={`/ticaret/satislar/${s.id}`} className="text-primary-light hover:underline">
                            {s.nomre}
                          </Link>
                        </td>
                        <td className="px-2 py-2">{s.musteri_ad || "—"}</td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">
                          {new Date(s.tarix).toLocaleDateString("az-AZ")}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatMoney(s.son_mebleg)}</td>
                        <td className="px-2 py-2 text-right">
                          <Badge variant="outline" className="h-5 text-[10px]">{s.status || "—"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Son hadisələr</CardTitle>
            <Link href="/audit-log" className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
              Audit <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Hələ hadisə yoxdur.</div>
            ) : (
              <ul className="space-y-2">
                {recentActivity.map((e) => {
                  const Icon = activityIconFor(e.tip);
                  return (
                    <li key={e.id} className="flex items-start gap-2.5 text-xs">
                      <div className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-foreground">{e.basliq}</div>
                        <div className="text-muted-foreground">
                          {new Date(e.tarix).toLocaleString("az-AZ", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Business activity feed (satış / alış / ödəniş / yeni müştəri / tamamlanan tapşırıq) */}
      <section>
        <RecentActivityWidget items={bizFeed} limit={12} />
      </section>

      {/* Empty state */}
      {kpisLegacy.todaySalesCount === 0 && kpisLegacy.stockValue === 0 && (
        <Card className="glass border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg"
                style={{ background: "var(--brand-gradient)" }}>
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">Sistemə başlayın</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hələ heç bir məhsul və ya satış yoxdur. İlk addımları ataq.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/anbar"><Package className="h-3.5 w-3.5" /> Məhsul əlavə et</Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/elaqe"><Users className="h-3.5 w-3.5" /> Müştəri əlavə et</Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/pos" target="_blank" rel="noopener">
                      <TrendingUp className="h-3.5 w-3.5" /> İlk satış
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type TopListItem = {
  key: string;
  name: string;
  sub: string;
  value: string;
  href?: string;
};

const TOP_TONE: Record<"info" | "warning" | "neutral" | "success", string> = {
  info:    "from-info/20 to-info/0 text-info",
  warning: "from-warning/20 to-warning/0 text-warning",
  neutral: "from-primary/15 to-primary/0 text-primary-light",
  success: "from-success/20 to-success/0 text-success",
};

function TopList({
  title,
  icon: Icon,
  tone,
  items,
  empty,
  href,
}: {
  title: string;
  icon: typeof Package;
  tone: "info" | "warning" | "neutral" | "success";
  items: TopListItem[];
  empty: string;
  href?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <div className={cn("pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl opacity-50 transition group-hover:opacity-80", TOP_TONE[tone])} />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("grid h-7 w-7 place-items-center rounded-lg bg-card", TOP_TONE[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-bold">{title}</h3>
        </div>
        {href && (
          <Link href={href} className="text-[10.5px] text-muted-foreground transition hover:text-primary-light">
            Hamısı →
          </Link>
        )}
      </div>
      <div className="relative mt-3">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">{empty}</div>
        ) : (
          <ul className="space-y-1">
            {items.map((it, i) => {
              const inner = (
                <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition hover:bg-secondary/40">
                  <span className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold tabular-nums",
                    i === 0 ? "bg-warning/20 text-warning" :
                    i === 1 ? "bg-foreground/10 text-foreground/70" :
                    i === 2 ? "bg-amber-700/20 text-amber-700 dark:text-amber-500" :
                    "bg-secondary text-muted-foreground"
                  )}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold leading-tight">{it.name}</div>
                    <div className="truncate text-[10.5px] text-muted-foreground">{it.sub}</div>
                  </div>
                  <div className="shrink-0 text-right text-[12.5px] font-bold tabular-nums">{it.value}</div>
                </div>
              );
              return (
                <li key={it.key}>
                  {it.href ? <Link href={it.href}>{inner}</Link> : inner}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
