import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Truck,
  ArrowRight,
  PiggyBank,
  Clock,
  Coins,
  Flame,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { DailyFlowChart } from "@/features/maliyye/components/daily-flow-chart";
import { NewOperationSheet } from "@/features/maliyye/components/new-operation-sheet";
import { QuickOpDialog } from "@/features/maliyye/components/quick-op-dialog";
import {
  getDashboardKpis,
  getDailyFlow,
  getTopExpenseCategories,
  getTopDebtors,
  getTopCreditors,
  getQuickRefs,
  getReceivableAging,
} from "@/features/maliyye/queries";
import { DebtAgingWidget } from "@/features/maliyye/components/debt-aging-widget";
import { CashflowForecast } from "@/features/maliyye/components/cashflow-forecast";
import { getCashFlowForecast } from "@/features/maliyye/cashflow-queries";
import { formatCompactMoney, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Maliyyə" };

type SP = { forecast?: string };

export default async function MaliyyePage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};
  const forecastDays = ([30, 60, 90].includes(Number(sp.forecast)) ? Number(sp.forecast) : 30) as 30 | 60 | 90;

  const [kpis, flow, topExp, topDeb, topCred, refs, aging, forecast] = await Promise.all([
    getDashboardKpis(),
    getDailyFlow(30),
    getTopExpenseCategories(5),
    getTopDebtors(5),
    getTopCreditors(5),
    getQuickRefs(),
    getReceivableAging(),
    getCashFlowForecast(forecastDays),
  ]);

  // Cash Runway hesabı — son 30 günün ortalama gündəlik xərci ilə neçə gün davam edə bilərik?
  const dailyBurn = kpis.ay_xerc > 0 ? kpis.ay_xerc / 30 : 0;
  const cashRunwayDays = dailyBurn > 0 && kpis.hesab_balans > 0
    ? Math.floor(kpis.hesab_balans / dailyBurn)
    : null;
  const runwayTone: "success" | "warning" | "danger" =
    cashRunwayDays === null ? "success" :
    cashRunwayDays >= 90 ? "success" :
    cashRunwayDays >= 30 ? "warning" : "danger";

  // Smart insight strip
  const insight = (() => {
    if (kpis.ay_menfeet < 0) {
      return {
        tone: "danger" as const,
        text: `Bu ay zərərlə işləyirsiniz (${formatMoney(Math.abs(kpis.ay_menfeet))}) — xərcləri azaldın və ya satışı artırın`,
        href: "/maliyye/xercler",
      };
    }
    if (cashRunwayDays !== null && cashRunwayDays < 30) {
      return {
        tone: "danger" as const,
        text: `Cash Runway yalnız ${cashRunwayDays} gün — pul ehtiyacınız var, gözləyən borcları yığın`,
        href: "/maliyye/debitor",
      };
    }
    if (kpis.gozleyen_odenis > 5) {
      return {
        tone: "warning" as const,
        text: `${kpis.gozleyen_odenis} ödəniş təsdiq gözləyir — yoxlayıb təsdiqləyin`,
        href: "/maliyye/emeliyyat?status=gozleyen_tesdiq",
      };
    }
    return null;
  })();

  const margin = kpis.ay_gelir > 0 ? (kpis.ay_menfeet / kpis.ay_gelir) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Maliyyə</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pul axını, mənfəət, debitor/kreditor borclar — biznesin maliyyə mərkəzi.
          </p>
        </div>
        <NewOperationSheet
          hesablar={refs.hesablar}
          iscilier={refs.iscilier}
          kontragentler={refs.kontragentler}
        />
      </header>

      <MaliyyeSubNav active="/maliyye" />

      {/* ─── AI insight strip ─── */}
      {insight && (
        <Link
          href={insight.href}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition hover:opacity-90 ${
            insight.tone === "danger"
              ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
              : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          }`}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="flex-1 font-medium">{insight.text}</span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      {/* ─── HERO: Ayın mənfəəti + Cash Runway ─── */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent p-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bu ayın mənfəəti
            </div>
            <PiggyBank className={`h-5 w-5 ${kpis.ay_menfeet >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
          </div>
          <div
            className={`mt-2 text-4xl font-bold tracking-tight ${
              kpis.ay_menfeet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
            }`}
            title={formatMoney(kpis.ay_menfeet)}
          >
            {kpis.ay_menfeet >= 0 ? "+" : "−"}
            {formatCompactMoney(Math.abs(kpis.ay_menfeet))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <div title={formatMoney(kpis.ay_gelir)}>
              <div className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-emerald-500" /> Gəlir (ay)
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCompactMoney(kpis.ay_gelir)}
              </div>
            </div>
            <div title={formatMoney(kpis.ay_xerc)}>
              <div className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
                <TrendingDown className="h-3 w-3 text-rose-500" /> Xərc (ay)
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums text-rose-500">
                {formatCompactMoney(kpis.ay_xerc)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
                <PiggyBank className="h-3 w-3" /> Marja
              </div>
              <div
                className={`mt-1 text-lg font-bold tabular-nums ${
                  margin < 0 ? "text-rose-500" : margin < 10 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {margin.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Cash Runway widget */}
        <div
          className={`rounded-2xl border p-5 ${
            runwayTone === "danger"
              ? "border-rose-500/30 bg-rose-500/5"
              : runwayTone === "warning"
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-emerald-500/30 bg-emerald-500/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cash Runway
            </div>
            <Flame
              className={`h-5 w-5 ${
                runwayTone === "danger" ? "text-rose-500" : runwayTone === "warning" ? "text-amber-500" : "text-emerald-500"
              }`}
            />
          </div>
          <div className="mt-2">
            {cashRunwayDays === null ? (
              <>
                <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">∞</div>
                <p className="mt-1 text-xs text-muted-foreground">Xərc yoxdur — qiymətləndirə bilmirik</p>
              </>
            ) : (
              <>
                <div
                  className={`text-3xl font-bold tracking-tight ${
                    runwayTone === "danger"
                      ? "text-rose-600 dark:text-rose-400"
                      : runwayTone === "warning"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {cashRunwayDays} gün
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cari xərc tempi ilə hesabınızda olan pul belə davam edə bilər.
                </p>
              </>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div title={formatMoney(kpis.hesab_balans)}>
              <div className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
                <Coins className="h-3 w-3" /> Hesab balansı
              </div>
              <div className="mt-1 text-sm font-bold tabular-nums">
                {formatCompactMoney(kpis.hesab_balans)}
              </div>
            </div>
            <div title={formatMoney(dailyBurn)}>
              <div className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
                <Calendar className="h-3 w-3" /> Gündə xərc
              </div>
              <div className="mt-1 text-sm font-bold tabular-nums text-rose-500">
                {formatCompactMoney(dailyBurn)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bugün ─── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bugün
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard icon={TrendingUp} label="Gəlir" value={formatMoney(kpis.bugun_gelir)} tone="success" />
          <KpiCard icon={TrendingDown} label="Xərc" value={formatMoney(kpis.bugun_xerc)} tone={kpis.bugun_xerc > 0 ? "warning" : "neutral"} />
          <KpiCard icon={Wallet} label="Net axın" value={formatMoney(kpis.bugun_net)} tone={kpis.bugun_net >= 0 ? "success" : "danger"} />
        </div>
      </section>

      {/* ─── Açıq vəziyyət ─── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Açıq vəziyyət
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard
            icon={Users}
            label="Debitor (sizdən pul gözləyirlər)"
            value={formatMoney(kpis.debitor_cem)}
            subline="müştəri borcları"
            tone={kpis.debitor_cem > 0 ? "warning" : "neutral"}
          />
          <KpiCard
            icon={Truck}
            label="Kreditor (siz borclusunuz)"
            value={formatMoney(kpis.kreditor_cem)}
            subline="təçhizatçı borcları"
            tone={kpis.kreditor_cem > 0 ? "danger" : "neutral"}
          />
          <KpiCard
            icon={Clock}
            label="Təsdiq gözləyir"
            value={String(kpis.gozleyen_odenis)}
            subline="sənəd"
            tone={kpis.gozleyen_odenis > 0 ? "warning" : "neutral"}
          />
        </div>
      </section>

      {/* ─── 30-day cashflow chart ─── */}
      <section>
        <Card className="glass">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Son 30 gün — pul axını</CardTitle>
              <Link
                href="/maliyye/pul-axini"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Detallı pul axını <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Yaşıl = gündəlik mədaxil · Qırmızı = məxaric · Xətt = net (mənfi günlər təhlükə)
            </p>
          </CardHeader>
          <CardContent>
            <DailyFlowChart data={flow} />
          </CardContent>
        </Card>
      </section>

      {/* ─── Debt aging analysis ─── */}
      <DebtAgingWidget buckets={aging.buckets} totalAmount={aging.total} />

      {/* ─── Cash flow forecast (M7) ─── */}
      <CashflowForecast initialRange={forecastDays} data={forecast} />

      {/* ─── Top 5 panels ─── */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <TopCard
          title="Top 5 xərc kateqoriyaları"
          icon={TrendingDown}
          rows={topExp}
          accent="text-rose-500"
          barCls="bg-rose-500"
          href="/maliyye/xercler"
        />
        <TopCard
          title="Top 5 borclu müştəri"
          icon={Users}
          rows={topDeb}
          accent="text-amber-600 dark:text-amber-400"
          barCls="bg-amber-500"
          href="/maliyye/debitor"
        />
        <TopCard
          title="Top 5 borclu olduğumuz təçhizatçı"
          icon={Truck}
          rows={topCred}
          accent="text-rose-600 dark:text-rose-400"
          barCls="bg-rose-600"
          href="/maliyye/kreditor"
        />
      </section>

      <QuickOpDialog
        hesablar={refs.hesablar}
        iscilier={refs.iscilier}
        kontragentler={refs.kontragentler}
      />
    </div>
  );
}

function TopCard({
  title,
  icon: Icon,
  rows,
  accent,
  barCls,
  href,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: { ad: string; mebleg: number }[];
  accent: string;
  barCls: string;
  href: string;
}) {
  const total = rows.reduce((s, r) => s + r.mebleg, 0);
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${accent}`} />
            <span className="truncate">{title}</span>
          </span>
          <span
            className={`shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] tabular-nums ${accent}`}
            title={formatMoney(total)}
          >
            {formatCompactMoney(total)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">Verilən yoxdur</div>
        )}
        {rows.map((r, i) => {
          const pct = total > 0 ? (r.mebleg / total) * 100 : 0;
          return (
            <div key={`${r.ad}-${i}`} className="space-y-0.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="line-clamp-1 max-w-[60%] text-muted-foreground" title={r.ad}>
                  {r.ad}
                </span>
                <span className={`tabular-nums font-semibold ${accent}`} title={formatMoney(r.mebleg)}>
                  {formatCompactMoney(r.mebleg)}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div className={`h-full opacity-40 ${barCls}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
          );
        })}
        <Link href={href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Hamısına bax <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
