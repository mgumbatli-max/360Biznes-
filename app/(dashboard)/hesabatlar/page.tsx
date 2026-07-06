import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp,
  Package,
  Wallet,
  Users,
  Briefcase,
  ArrowRight,
  Coins,
  Wrench,
  Store,
  Truck,
  Sparkles,
  Boxes,
  Receipt,
  Percent,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Activity,
  ShoppingCart,
  Award,
  Flame,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { liteGate } from "@/lib/lite/config";
import { getSalesKpi, getTopProductsExt, getTopCustomersExt, getYoyComparison } from "@/features/hesabatlar/satis-queries";
import { getPlSummary, getMonthlyPl12 } from "@/features/hesabatlar/maliyye-queries";
import { getStockCounters } from "@/features/hesabatlar/stok-queries";
import { getNewReturning, getDebtBuckets } from "@/features/hesabatlar/musteri-queries";
import { getDailyCashFlow30, getCashFlowSummary30 } from "@/features/hesabatlar/pul-queries";
import { buildAiInsightsCached as buildAiInsights } from "@/features/hesabatlar/ai-insights";
import { thisMonthRange, lastMonthRange } from "@/features/hesabatlar/shared";
import { formatMoney, formatNumber, formatDate, cn } from "@/lib/utils";
import { getStealthState } from "@/lib/stealth/server"; // QA-orta: gizli rejim miqyası

export const metadata: Metadata = { title: "Hesabatlar — Executive Hub" };

const CARDS: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  gradient: string;
  badge?: string;
}[] = [
  { href: "/hesabatlar/satis", icon: TrendingUp, title: "Satış", desc: "KPI, trend, heatmap, marja, YoY, top məhsul/müştəri/satıcı", gradient: "from-indigo-500 to-purple-500" },
  { href: "/hesabatlar/marja", icon: Percent, title: "Marja", desc: "Kateqoriya & məhsul marja, loss leaders, cash cows, müştəri marjı", gradient: "from-emerald-500 to-teal-500", badge: "Yeni" },
  { href: "/hesabatlar/mehsul", icon: Package, title: "Məhsul", desc: "ABC analizi, ölü stok, top movers, marjin", gradient: "from-emerald-500 to-cyan-500" },
  { href: "/hesabatlar/musteri", icon: Users, title: "Müştəri", desc: "LTV, cohort, geo, borc bucket, segmentation", gradient: "from-amber-500 to-orange-500" },
  { href: "/hesabatlar/rfm", icon: Target, title: "RFM seqmentasiya", desc: "Müştəri dəyər/risk seqmentləri, churn (itki) riski, yenidən cəlb siyahısı", gradient: "from-rose-500 to-red-500", badge: "Yeni" },
  { href: "/hesabatlar/stok", icon: Boxes, title: "Stok", desc: "Anbar/kateqoriya dəyər, hərəkət, reorder", gradient: "from-cyan-500 to-blue-500" },
  { href: "/hesabatlar/pul", icon: Coins, title: "Pul axını", desc: "Daily kassa, mədaxil/məxaric, runway, hesab balans", gradient: "from-pink-500 to-rose-500" },
  { href: "/hesabatlar/maliyye", icon: Wallet, title: "Maliyyə (P&L)", desc: "Waterfall, YoY, sabit/dəyişkən xərc, 12 aylıq trend", gradient: "from-violet-500 to-fuchsia-500" },
  { href: "/hesabatlar/servis", icon: Wrench, title: "Servis", desc: "ROI, status, top texniklər", gradient: "from-orange-500 to-red-500" },
  { href: "/hesabatlar/marketplace", icon: Store, title: "Marketplace", desc: "Platforma, komissiya, net", gradient: "from-lime-500 to-emerald-500" },
  { href: "/hesabatlar/emekdas", icon: Briefcase, title: "Əməkdaş", desc: "Satıcı performans, davamiyyət", gradient: "from-blue-500 to-indigo-500" },
  { href: "/hesabatlar/idxal", icon: Truck, title: "İdxal / Alış", desc: "Təchizatçı, vergi, gömrük, borc", gradient: "from-yellow-500 to-amber-500" },
  { href: "/hesabatlar/techizatci", icon: Award, title: "Təchizatçı scorecard", desc: "Təchizatçı qiymətləndirmə (A–F): qaytarma, qiymət-trendi, etibarlılıq, seqment", gradient: "from-amber-500 to-yellow-500", badge: "Yeni" },
  { href: "/servis/hesabat", icon: Receipt, title: "Servis (geniş)", desc: "Texniki performans, defekt analizi", gradient: "from-slate-500 to-zinc-500" },
  { href: "/hesabatlar/ai", icon: Sparkles, title: "AI Insights", desc: "AI tövsiyə, kritik alarm, fürsət aşkarlanması", gradient: "from-purple-500 to-pink-500", badge: "AI" },
];

const INSIGHT_TONE = {
  info: { cls: "border-l-sky-500 bg-sky-500/5", icon: Info, color: "text-sky-500" },
  success: { cls: "border-l-emerald-500 bg-emerald-500/5", icon: CheckCircle2, color: "text-emerald-500" },
  warning: { cls: "border-l-amber-500 bg-amber-500/5", icon: AlertTriangle, color: "text-amber-500" },
  danger: { cls: "border-l-rose-500 bg-rose-500/5", icon: AlertCircle, color: "text-rose-500" },
};

function Sparkline({ values, color = "hsl(var(--primary))", height = 32 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2 || values.every((v) => v === 0)) {
    return <div className="text-[10px] text-muted-foreground">—</div>;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 100;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sl-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points={`0,${height} ${pts} ${w},${height}`} fill="url(#sl-grad)" />
    </svg>
  );
}

function delta(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function KpiGridSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </section>
  );
}

function TrendsRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

function TopRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-72 rounded-xl" />
      ))}
    </div>
  );
}

export default async function HesabatlarHubPage() {
  const thisR = thisMonthRange();
  const lite = await liteGate("hesabatlar"); // Lite-da bloklar config-ə görə
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Hero header — render immediately. */}
      <header className="rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card/80 to-card/50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Hesabatlar — Executive Hub</h1>
              <Suspense fallback={null}>
                <CriticalCountBadge />
              </Suspense>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Bu ayın xülasəsi, AI insight-lar və bütün alt-hesabatlara giriş —{" "}
              <span className="font-medium text-foreground">
                {formatDate(thisR.from, { day: "numeric", month: "long" })} —{" "}
                {formatDate(new Date(), { day: "numeric", month: "long" })}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/hesabatlar/ai"
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
            >
              <Sparkles className="h-3 w-3" />
              AI Insights
            </Link>
            <Link
              href="/hesabatlar/maliyye"
              className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-500 hover:bg-violet-500/15"
            >
              <Wallet className="h-3 w-3" />
              P&L
            </Link>
            <Link
              href="/hesabatlar/marja"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/15"
            >
              <Percent className="h-3 w-3" />
              Marja
            </Link>
          </div>
        </div>
      </header>

      {lite("ozet") && (
        <Suspense fallback={<KpiGridSkeleton />}>
          <ExecutiveKpiSection />
        </Suspense>
      )}

      <CollapsibleSection title="AI kritik siqnallar" defaultOpen={false}>
        <Suspense fallback={null}>
          <AiInsightsSection />
        </Suspense>
      </CollapsibleSection>

      {lite("qrafikler") && (
        <CollapsibleSection title="Trendlər" defaultOpen={false}>
          <Suspense fallback={<TrendsRowSkeleton />}>
            <TrendsRow />
          </Suspense>
        </CollapsibleSection>
      )}

      {lite("detal_cedvel") && (
        <CollapsibleSection title="Liderlər (məhsul / müştəri)" defaultOpen={false}>
          <Suspense fallback={<TopRowSkeleton />}>
            <TopPerformersRow />
          </Suspense>
        </CollapsibleSection>
      )}

      {/* Report navigation cards — pure static, render immediately. */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Bütün hesabatlar</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="group">
              <Card className="glass relative h-full overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/5">
                <div
                  className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${c.gradient} opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-50`}
                />
                <CardContent className="relative space-y-3 py-5">
                  <div className="flex items-start justify-between">
                    <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${c.gradient} shadow-md transition group-hover:scale-110 group-hover:rotate-3`}>
                      <c.icon className="h-5 w-5 text-white" />
                    </div>
                    {c.badge && (
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[9px] text-primary">
                        {c.badge}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold tracking-tight">{c.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-primary-light transition group-hover:gap-2">
                    Hesabata bax <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

async function CriticalCountBadge() {
  const ai = await buildAiInsights().catch(() => ({ insights: [], ai_text: "", is_mock: true }));
  const criticalCount = ai.insights.filter((i) => (i.severity ?? 0) >= 7).length;
  if (criticalCount === 0) return null;
  return (
    <Badge variant="outline" className="animate-pulse border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-500">
      <Flame className="mr-1 h-2.5 w-2.5" />
      {criticalCount} kritik
    </Badge>
  );
}

async function ExecutiveKpiSection() {
  const thisR = thisMonthRange();
  const lastR = lastMonthRange();
  const [sales, lastSales, pl, lastPl, stok, must, debt, daily30, yoy] = await Promise.all([
    getSalesKpi({ range: thisR }),
    getSalesKpi({ range: lastR }),
    getPlSummary(thisR),
    getPlSummary(lastR),
    getStockCounters(),
    getNewReturning(thisR),
    getDebtBuckets(),
    getDailyCashFlow30(),
    getYoyComparison(thisR),
  ]);

  const cf = await getCashFlowSummary30(daily30);
  // QA-orta: gizli rejim əvvəl yalnız getSalesKpi-yə tətbiq olunurdu — P&L/stok/
  // kassa/borc KPI-ları raw qalır, "net mənfəət satışdan böyük" absurdu yaranırdı.
  // Pul KPI-ları ekran səviyyəsində eyni miqyas (sc) ilə göstərilir; DB, eksport
  // və AI-insight sorğuları toxunulmaz qalır.
  const stealth = await getStealthState();
  const sc = stealth.aktiv ? stealth.scale : 1;
  const totalDebt = debt.reduce((s, b) => s + b.amount, 0) * sc;
  const overdueDebt = debt.filter((b) => b.bucket !== "0-30").reduce((s, b) => s + b.amount, 0) * sc;
  const revenueChange = delta(sales.total_amount, lastSales.total_amount);
  const profitChange = delta(pl.net_profit, lastPl.net_profit);
  const grossChange = delta(pl.gross_profit, lastPl.gross_profit);
  const opexChange = delta(pl.opex, lastPl.opex);

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        icon={ShoppingCart}
        label="Bu ay satış"
        value={formatMoney(sales.total_amount)}
        subline={`${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% MoM · ${yoy.change_pct >= 0 ? "+" : ""}${yoy.change_pct.toFixed(1)}% YoY`}
        tone={revenueChange >= 0 ? "success" : "danger"}
      />
      <KpiCard
        icon={Wallet}
        label="Net mənfəət"
        value={formatMoney(pl.net_profit * sc)}
        subline={`${pl.net_margin_pct.toFixed(1)}% net margin · ${profitChange >= 0 ? "+" : ""}${profitChange.toFixed(1)}% MoM`}
        tone={pl.net_profit >= 0 ? "success" : "danger"}
      />
      <KpiCard
        icon={Percent}
        label="Brüt mənfəət"
        value={formatMoney(pl.gross_profit * sc)}
        subline={`${pl.gross_margin_pct.toFixed(1)}% gross margin · ${grossChange >= 0 ? "+" : ""}${grossChange.toFixed(1)}%`}
        tone={pl.gross_margin_pct >= 25 ? "success" : "warning"}
      />
      <KpiCard
        icon={Receipt}
        label="OPEX"
        value={formatMoney(pl.opex * sc)}
        subline={`${opexChange >= 0 ? "+" : ""}${opexChange.toFixed(1)}% MoM`}
        tone={opexChange <= 0 ? "success" : "warning"}
      />
      <KpiCard
        icon={Users}
        label="Aktiv müştəri"
        value={String(must.active_in_period)}
        subline={`${must.new_count} yeni · ${must.returning_count} təkrar`}
        tone="info"
      />
      <KpiCard
        icon={Boxes}
        label="Stok dəyəri"
        value={formatMoney(stok.total_value * sc)}
        subline={`${stok.product_count} məhsul · ${stok.reorder_count} sifariş tələb`}
        tone={stok.reorder_count > 0 ? "warning" : "neutral"}
      />
      <KpiCard
        icon={Coins}
        label="Kassa qalığı"
        value={formatMoney(cf.closing_balance * sc)}
        subline={cf.runway_days != null ? `Runway: ${cf.runway_days} gün` : `Net: ${formatMoney(cf.net * sc)}`}
        tone={cf.closing_balance > 0 ? (cf.runway_days != null && cf.runway_days < 30 ? "danger" : "success") : "danger"}
      />
      <KpiCard
        icon={AlertTriangle}
        label="Debitor borc"
        value={formatMoney(totalDebt)}
        subline={overdueDebt > 0 ? `${formatMoney(overdueDebt)} gecikmiş` : "Hamısı vaxtında"}
        tone={overdueDebt > 0 ? "warning" : "neutral"}
      />
    </section>
  );
}

async function AiInsightsSection() {
  const ai = await buildAiInsights().catch((e) => {
    console.error("[hesabatlar.buildAiInsights]", e);
    return { insights: [], ai_text: "", is_mock: true };
  });
  const topInsights = ai.insights.slice(0, 5);
  if (topInsights.length === 0) return null;
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Biznes Insight — top {topInsights.length} kritik
          </span>
          <Link href="/hesabatlar/ai" className="text-[10.5px] font-semibold text-primary hover:underline">
            Hamısına bax →
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {topInsights.map((ins, i) => {
            const t = INSIGHT_TONE[ins.kind];
            const Icon = t.icon;
            return (
              <div key={i} className={cn("rounded-lg border border-l-4 bg-card/40 p-3 transition hover:-translate-y-0.5", t.cls)}>
                <div className="flex items-start gap-2">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="text-sm font-semibold">{ins.title}</h4>
                      {(ins.severity ?? 0) >= 7 && (
                        <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-[9px] text-rose-500">
                          <Flame className="mr-0.5 h-2 w-2" />
                          {ins.severity}/10
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{ins.body}</p>
                    {ins.action_href && (
                      <Link href={ins.action_href} className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary hover:gap-1.5 transition-all">
                        {ins.action_label ?? "Ətraflı"}
                        <ArrowRight className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

async function TrendsRow() {
  const [monthly, daily30] = await Promise.all([
    getMonthlyPl12(),
    getDailyCashFlow30(),
  ]);
  const cf = await getCashFlowSummary30(daily30);
  // QA-orta: pul etiketləri KPI bölməsi ilə eyni gizli-rejim miqyasında göstərilsin
  const stealth = await getStealthState();
  const sc = stealth.aktiv ? stealth.scale : 1;
  const revSeries = monthly.map((m) => m.revenue);
  const netSeries = monthly.map((m) => m.net);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              12 aylıq gəlir trendi
            </span>
            <span className="text-[10px] font-normal text-muted-foreground">{monthly.length} ay</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Sparkline values={revSeries} color="hsl(228 100% 67%)" height={64} />
          <div className="mt-2 flex items-center justify-between text-[10.5px]">
            <span className="text-muted-foreground">{monthly[0]?.ay ?? "—"}</span>
            <span className="font-semibold tabular-nums">{formatMoney((monthly[monthly.length - 1]?.revenue ?? 0) * sc)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-emerald-500" />
              12 aylıq net mənfəət
            </span>
            <span className="text-[10px] font-normal text-muted-foreground">12 ay</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Sparkline values={netSeries} color="hsl(160 60% 52%)" height={64} />
          <div className="mt-2 flex items-center justify-between text-[10.5px]">
            <span className="text-muted-foreground">trend</span>
            <span className="font-semibold tabular-nums">{formatMoney((monthly[monthly.length - 1]?.net ?? 0) * sc)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Coins className="h-3.5 w-3.5 text-pink-500" />
              30 günlük pul axını
            </span>
            <span className="text-[10px] font-normal text-muted-foreground">net: {formatMoney(cf.net * sc)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Sparkline
            values={daily30.map((d) => d.daxil - d.xaric)}
            color={cf.net >= 0 ? "hsl(160 60% 52%)" : "hsl(0 91% 71%)"}
            height={64}
          />
          <div className="mt-2 flex items-center justify-between text-[10.5px]">
            <span className="text-muted-foreground">qalıq</span>
            <span className="font-semibold tabular-nums">{formatMoney(cf.closing_balance * sc)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function TopPerformersRow() {
  const thisR = thisMonthRange();
  const [topProducts, topCustomers] = await Promise.all([
    getTopProductsExt({ range: thisR }, 5),
    getTopCustomersExt({ range: thisR }, 5),
  ]);
  // QA-orta: pul rəqəmləri KPI bölməsi ilə eyni gizli-rejim miqyasında göstərilsin
  const stealth = await getStealthState();
  const sc = stealth.aktiv ? stealth.scale : 1;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              Top 5 məhsul (bu ay)
            </span>
            <Link href="/hesabatlar/mehsul" className="text-[10.5px] font-semibold text-primary hover:underline">
              Hamısı →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/30">
            {topProducts.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">Bu ay satış yoxdur</li>
            ) : (
              topProducts.map((p, i) => (
                <li key={p.mehsul_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className="h-5 w-5 shrink-0 justify-center p-0 text-[10px]">{i + 1}</Badge>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.ad}</div>
                      <div className="text-[10px] text-muted-foreground">{formatNumber(p.satilan_qty, 0)} ədəd</div>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(p.cemi * sc)}</span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Top 5 müştəri (bu ay)
            </span>
            <Link href="/hesabatlar/musteri" className="text-[10.5px] font-semibold text-primary hover:underline">
              Hamısı →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/30">
            {topCustomers.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">Bu ay müştəri yoxdur</li>
            ) : (
              topCustomers.map((c, i) => (
                <li key={c.musteri_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className="h-5 w-5 shrink-0 justify-center p-0 text-[10px]">{i + 1}</Badge>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.ad}</div>
                      <div className="text-[10px] text-muted-foreground">{c.sifaris_say} sifariş</div>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(c.cemi * sc)}</span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
