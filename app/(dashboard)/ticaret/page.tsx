import type { Metadata } from "next";
import Link from "next/link";
import {
  ShoppingCart,
  Factory,
  CreditCard,
  Undo2,
  Truck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { RefreshButton } from "@/components/refresh-button";
import { NewOperationButton } from "@/features/ticaret/components/new-operation-dialog";
import {
  getTradeKpis,
  getSalesByDay,
  getTopSellers,
  getTopProducts,
  getTradeInsights,
  getSalesFunnel,
} from "@/features/ticaret/dashboard-queries";
import { getTargetProgress } from "@/features/ticaret/satis-hedef";
import { SalesTargetWidget } from "@/features/ticaret/components/sales-target-widget";
import { TradeInsights } from "@/features/ticaret/components/trade-insights";
import { SalesFunnel } from "@/features/ticaret/components/sales-funnel";
import { getAttentionProducts } from "@/features/anbar/attention-queries";
import { AttentionWidget } from "@/features/anbar/components/attention-widget";
import { SalesForecastWidget } from "@/features/ticaret/components/sales-forecast-widget";
import { CrossSellWidget } from "@/features/ticaret/components/cross-sell-widget";
import { ErrorSilentWrapper } from "@/components/error-silent-wrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { formatNumber, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Ticarət" };

/* Streaming sections — KPI section ən vacib, dərhal stream, qalanlar paralel. */

async function InsightsSection() {
  const insights = await getTradeInsights();
  if (insights.length === 0) return null;
  return (
    <div className="mt-5">
      <TradeInsights insights={insights} />
    </div>
  );
}

async function KpiSection() {
  const kpis = await getTradeKpis();
  return (
    <>
      <h3 className="mt-6 mb-3 text-sm font-semibold tracking-tight">Bugün</h3>
      <div className="grid grid-cols-2 gap-6 border-y border-border py-5 md:grid-cols-3 lg:grid-cols-4">
        <Kpi
          label="Satış"
          icon={ShoppingCart}
          tone="success"
          value={kpis.satish.bugun_say}
          sub={formatMoney(kpis.satish.bugun_meb)}
          href="/ticaret/satislar"
        />
        <Kpi
          label="Alış"
          icon={Factory}
          value={kpis.alish.bugun_say}
          sub={formatMoney(kpis.alish.bugun_meb)}
          href="/ticaret/alislar"
        />
        <Kpi
          label="Mənfəət (bugün)"
          icon={TrendingUp}
          tone="success"
          value={formatMoney(kpis.satish.bugun_xalis)}
          sub="xalis məbləğ"
        />
        <Kpi
          label="Qaytarma (ay)"
          icon={Undo2}
          tone={kpis.qaytarma.meb > 0 ? "warning" : "neutral"}
          value={kpis.qaytarma.say}
          sub={formatMoney(kpis.qaytarma.meb)}
          href="/ticaret/qaytarma"
        />
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold tracking-tight">Bu ay</h3>
      <div className="grid grid-cols-2 gap-6 border-y border-border py-5 md:grid-cols-3 lg:grid-cols-4">
        <Kpi
          label="Satış (ay)"
          icon={ShoppingCart}
          tone="success"
          value={kpis.satish.ay_say}
          sub={formatMoney(kpis.satish.ay_meb)}
          href="/ticaret/satislar"
        />
        <Kpi
          label="Alış (ay)"
          icon={Factory}
          value={kpis.alish.ay_say}
          sub={formatMoney(kpis.alish.ay_meb)}
          href="/ticaret/alislar"
        />
        <Kpi
          label="Kreditlə satış"
          icon={CreditCard}
          tone="warning"
          value={kpis.satish.kredit_say}
          sub={`Qalıq: ${formatMoney(kpis.satish.kredit_borc)}`}
          href="/ticaret/kredit"
        />
        <Kpi
          label="Xalis (ay)"
          icon={TrendingUp}
          tone="success"
          value={formatMoney(kpis.satish.ay_xalis)}
          sub="mənfəət"
        />
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold tracking-tight">Açıq proseslər</h3>
      <div className="grid grid-cols-2 gap-6 border-y border-border py-5 md:grid-cols-3 lg:grid-cols-4">
        <Kpi
          label="Açıq alış sifarişləri"
          icon={Truck}
          tone={kpis.alish.aciq_say > 0 ? "warning" : "neutral"}
          value={kpis.alish.aciq_say}
          sub={formatMoney(kpis.alish.aciq_meb)}
          href="/ticaret/alislar?status=gozlemede"
        />
        <Kpi
          label="Gözləyən qaytarmalar"
          icon={AlertTriangle}
          tone={kpis.qaytarma.gozleyen > 0 ? "warning" : "neutral"}
          value={kpis.qaytarma.gozleyen}
          sub="təsdiq tələb edir"
          href="/ticaret/qaytarma"
        />
        <Kpi
          label="Aktiv kreditli satışlar"
          icon={CreditCard}
          tone={kpis.satish.kredit_say > 0 ? "warning" : "neutral"}
          value={kpis.satish.kredit_say}
          sub={`Borc: ${formatMoney(kpis.satish.kredit_borc)}`}
          href="/ticaret/kredit"
        />
        <Kpi
          label="Aktiv təkliflər"
          icon={FileText}
          value={kpis.teklif.aktiv}
          sub="cavab gözləyir"
          href="/ticaret/teklif"
        />
      </div>
    </>
  );
}

function KpiSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="grid grid-cols-2 gap-6 border-y border-border py-5 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, j) => (
            <Skeleton key={j} className="h-16 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}

async function TargetAttentionSection() {
  const [target, attention] = await Promise.all([getTargetProgress(), getAttentionProducts(5)]);
  return (
    <div className="mt-5 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SalesTargetWidget data={target} />
      </div>
      <AttentionWidget items={attention} mode="ticaret" />
    </div>
  );
}

async function ChartAndSellersSection() {
  const [chart, men] = await Promise.all([getSalesByDay(30), getTopSellers(5)]);
  const maxBar = Math.max(1, ...chart.map((d) => d.meb));
  return (
    <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
        <h4 className="mb-3 text-sm font-semibold tracking-tight">Son 30 gün satış</h4>
        {chart.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Bu dövrdə satış yoxdur.</div>
          ) : (
            <div className="flex h-40 items-end gap-[3px] pt-2">
              {chart.map((d) => {
                const pct = Math.max(2, Math.round((d.meb / maxBar) * 100));
                return (
                  <div
                    key={d.tarix}
                    title={`${d.tarix} — ${formatMoney(d.meb)} (${d.say} satış)`}
                    className="flex flex-1 cursor-pointer flex-col items-center gap-0.5"
                  >
                    <div
                      className="w-full rounded-t bg-success/80 transition hover:bg-success"
                      style={{ height: `${pct}%`, minHeight: "2px" }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-3 text-sm font-semibold tracking-tight">Top satıcılar (cari ay)</h4>
          <ul className="space-y-0">
            {men.length === 0 && <li className="py-2 text-sm text-muted-foreground">Bu ay satıcı satışı yoxdur</li>}
            {men.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {m.ad} <small className="ml-1 text-muted-foreground">({m.say})</small>
                </span>
                <span className="font-semibold tabular-nums text-success">{formatNumber(m.meb)}₼</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
}

async function TopProductsAndFunnelSection() {
  const [pro, funnel] = await Promise.all([getTopProducts(5), getSalesFunnel()]);
  return (
    <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-3 text-sm font-semibold tracking-tight">Top məhsullar (cari ay)</h4>
        <ul className="space-y-0">
          {pro.length === 0 && <li className="py-2 text-sm text-muted-foreground">Bu ay satılan məhsul yoxdur</li>}
          {pro.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0">
              <span className="min-w-0 flex-1 truncate font-medium">
                {p.ad}
                <small className="ml-1 text-muted-foreground">
                  ({formatNumber(p.miqdar, 1)} əd{p.kod ? ` · ${p.kod}` : ""})
                </small>
              </span>
              <span className="font-semibold tabular-nums text-success">{formatNumber(p.meb)}₼</span>
            </li>
          ))}
        </ul>
      </div>
      <SalesFunnel data={funnel} />
    </div>
  );
}

export default async function TicaretHubPage() {
  const { requireTicaretPerm } = await import("@/features/ticaret/access-guard");
  await requireTicaretPerm();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Ticarət</h1>
        <div className="flex items-center gap-2">
          <NewOperationButton />
          <RefreshButton />
        </div>
      </div>

      <TicaretSubNav active="/ticaret" />

      <Suspense fallback={null}>
        <InsightsSection />
      </Suspense>

      <Suspense fallback={<KpiSkeleton />}>
        <KpiSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="mt-5 h-44 rounded-xl" />}>
        <TargetAttentionSection />
      </Suspense>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ErrorSilentWrapper name="forecast">
          <SalesForecastWidget />
        </ErrorSilentWrapper>
        <ErrorSilentWrapper name="cross-sell">
          <CrossSellWidget />
        </ErrorSilentWrapper>
      </div>

      <Suspense fallback={<Skeleton className="mt-3.5 h-56 rounded-xl" />}>
        <ChartAndSellersSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="mt-3.5 h-56 rounded-xl" />}>
        <TopProductsAndFunnelSection />
      </Suspense>
    </div>
  );
}

function Kpi({
  label,
  icon: Icon,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  icon: LucideIcon;
  value: number | string;
  sub?: string;
  tone?: "success" | "warning" | "danger" | "neutral";
  href?: string;
}) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : tone === "danger"
      ? "text-danger"
      : "text-foreground";

  const body = (
    <div className="cursor-pointer transition hover:opacity-70">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-2 text-[22px] font-semibold leading-none tabular-nums tracking-tight ${cls}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
