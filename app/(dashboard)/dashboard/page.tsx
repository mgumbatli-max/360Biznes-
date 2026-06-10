import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  Package,
  Users,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { getAppMode } from "@/lib/app-mode";
import { getLiteConfig, liteBlockOn } from "@/lib/lite/config";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/features/dashboard/components/demo-banner";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { DashboardQuickActions } from "@/features/dashboard/components/dashboard-quick-actions";
import { HeroSection } from "@/features/dashboard/sections/hero-section";
import { LowStockSection } from "@/features/dashboard/sections/low-stock-section";
import { TopFiveSection } from "@/features/dashboard/sections/top-five-section";
import { RecentSalesActivity } from "@/features/dashboard/sections/recent-sales-activity";
import { BusinessFeedSection } from "@/features/dashboard/sections/business-feed-section";
import { WebhookOrdersSection } from "@/features/dashboard/sections/webhook-orders-section";
import { SyncHealthSection } from "@/features/dashboard/sections/sync-health-section";
import { CriticalAlertsSection } from "@/features/dashboard/sections/critical-alerts-section";
import { TopDebtorsSection } from "@/features/dashboard/sections/top-debtors-section";
import { getDashboardKpis } from "@/features/dashboard/queries";

// Has() helper — paylaşılan sintaksis hər bölmə üçün
const has = (icazeler: string[], code: string) => icazeler.includes(code);

export const metadata: Metadata = { title: "Dashboard" };

function HeroSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-44 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    </div>
  );
}

function ChartSkeleton({ h = 260 }: { h?: number }) {
  return <Skeleton style={{ height: h }} className="w-full rounded-xl" />;
}

async function DashboardEmptyState() {
  const kpisLegacy = await getDashboardKpis();
  if (kpisLegacy.todaySalesCount === 0 && kpisLegacy.stockValue === 0) {
    return (
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
    );
  }
  return null;
}

export default async function DashboardPage() {
  // Yalnız session-u sinxron çək — heç bir DB sorğusu burada yox.
  // Bütün widgetlər öz Suspense-ində paralel + müstəqil stream olur.
  const [session, icazeler, appMode] = await Promise.all([
    auth(),
    getRequestPermissions(),
    getAppMode(),
  ]);
  if (!session?.user) return null;
  const u = session.user;

  // Lite rejimi — hansı bölmələrin göründüyü artıq sahibkarın konfiqurasiyasından
  // gəlir (/ayarlar/gorunis → ayarlar cədvəli). Pro-da hamısı (config nəzərə alınmır).
  const lite = appMode === "lite";
  const liteCfg = lite ? await getLiteConfig() : null;
  const liteOn = (blok: string) =>
    !lite || (liteCfg ? liteBlockOn(liteCfg, "dashboard", blok) : true);

  // Sahibkar/admin = tam giriş (ad ilə — id klon səbəbindən etibarsız, audit #14).
  // Bu, icazə cədvəlinin prod-da seed olunmamasından asılı olmadan owner-i keçirir
  // (access-guard-lardakı isXPrivileged bypass-ı ilə eyni məntiq).
  const isPrivileged = ["sahibkar", "admin"].includes(
    ((u as { rol_ad?: string }).rol_ad ?? "").toLowerCase(),
  );

  // Master icazə yoxlaması — `dashboard.oxu` yoxdursa ana səhifə yox.
  // Bu yoxlama sidebar-da artıq nav item-i gizlədir, lakin URL-ə birbaşa
  // daxil olan istifadəçi üçün də mütləq lazımdır.
  if (!isPrivileged && !has(icazeler, "dashboard.oxu")) {
    redirect("/tapshiriqlar");
  }

  // İcazə (perm) + Lite config birləşir. Pro-da yalnız icazə, Lite-da həm də
  // sahibkarın seçdiyi bloklar. Registry blok kodları: lib/lite/registry.ts.
  const canKpi       = (isPrivileged || has(icazeler, "dashboard.kpi"))       && liteOn("kpi");
  const canCashflow  = (isPrivileged || has(icazeler, "dashboard.cashflow"))  && liteOn("kpi");
  const canTapshiriq = (isPrivileged || has(icazeler, "dashboard.tapshiriq")) && liteOn("kpi");
  const canStok      = (isPrivileged || has(icazeler, "dashboard.stok"))      && liteOn("lowStock");
  const canTop5      = (isPrivileged || has(icazeler, "dashboard.top5"))      && liteOn("top5");
  const canAlerts    = (isPrivileged || has(icazeler, "dashboard.alerts"))    && liteOn("alerts");
  const canDebtors   = (isPrivileged || has(icazeler, "dashboard.cashflow"))  && liteOn("debtors");
  const canAktivlik  = (isPrivileged || has(icazeler, "dashboard.aktivlik"))  && liteOn("activity");
  const canSync      = (isPrivileged || has(icazeler, "dashboard.sync"))      && liteOn("sync");
  const canFeed      = (isPrivileged || has(icazeler, "dashboard.feed"))      && liteOn("feed");
  const canCharts    = (isPrivileged || has(icazeler, "dashboard.charts"))    && liteOn("charts");
  const canInsight   = (isPrivileged || has(icazeler, "dashboard.insight"))   && liteOn("insight");

  // HeroSection tək komponentin içində bir neçə bölmə var (insight banner,
  // KPI grid, cashflow, mənim işim, qrafiklər). İcazələrə görə hissəli render.
  const showHero = canKpi || canCashflow || canTapshiriq || canCharts || canInsight;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <DemoBanner
        abuneBitme={u.abune_bitme}
        abuneStatus={u.abune_status}
        novu={u.abune_status === "sinaq" ? "sinaq" : null}
      />

      <DashboardHeader user={u} />
      <DashboardQuickActions icazeler={icazeler} rolAd={u.rol_ad} />

      <div className="space-y-8 stagger-children">
        {showHero && (
          <Suspense fallback={<HeroSkeleton />}>
            <HeroSection
              showInsight={canInsight}
              showKpi={canKpi}
              showCashflow={canCashflow}
              showTapshiriq={canTapshiriq}
              showCharts={canCharts}
            />
          </Suspense>
        )}

        {canAlerts && (
          <Suspense fallback={null}>
            <CriticalAlertsSection />
          </Suspense>
        )}

        {canStok && (
          <Suspense fallback={<ChartSkeleton h={260} />}>
            <LowStockSection />
          </Suspense>
        )}

        {canTop5 && (
          <Suspense fallback={<ChartSkeleton h={220} />}>
            <TopFiveSection />
          </Suspense>
        )}

        {canDebtors && <TopDebtorsSection />}

        {canAktivlik && (
          <Suspense fallback={<ChartSkeleton h={300} />}>
            <RecentSalesActivity />
          </Suspense>
        )}

        {canFeed && (
          <Suspense fallback={<ChartSkeleton h={300} />}>
            <BusinessFeedSection />
          </Suspense>
        )}

        {canSync && (
          <>
            <Suspense fallback={null}>
              <WebhookOrdersSection />
            </Suspense>
            <Suspense fallback={null}>
              <SyncHealthSection />
            </Suspense>
          </>
        )}

        <Suspense fallback={null}>
          <DashboardEmptyState />
        </Suspense>
      </div>
    </div>
  );
}
