import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp,
  Package,
  Users,
  ScanLine,
  Wrench,
  FileBarChart,
  PlusCircle,
  UserPlus,
  Receipt,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/features/dashboard/components/demo-banner";
import { AutoRefresh } from "@/features/audit-log/components/auto-refresh";
import { HeroSection } from "@/features/dashboard/sections/hero-section";
import { LowStockSection } from "@/features/dashboard/sections/low-stock-section";
import { TopFiveSection } from "@/features/dashboard/sections/top-five-section";
import { RecentSalesActivity } from "@/features/dashboard/sections/recent-sales-activity";
import { BusinessFeedSection } from "@/features/dashboard/sections/business-feed-section";
import { WebhookOrdersSection } from "@/features/dashboard/sections/webhook-orders-section";
import { SyncHealthSection } from "@/features/dashboard/sections/sync-health-section";
import { CriticalAlertsSection } from "@/features/dashboard/sections/critical-alerts-section";
import { getDashboardKpis } from "@/features/dashboard/queries";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

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
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user;

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
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
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

      {/* Hər Suspense müstəqil stream olur — shell instant render olunur,
          ən yavaş sorğu yalnız öz blokunu gecikdirir, qalanları bloklamır.
          stagger-children: bölmələr 60ms gecikmə ilə kaskadla görünür (modern feel). */}
      <div className="space-y-8 stagger-children">
        <Suspense fallback={<HeroSkeleton />}>
          <HeroSection />
        </Suspense>

        <Suspense fallback={null}>
          <CriticalAlertsSection />
        </Suspense>

        <Suspense fallback={<ChartSkeleton h={260} />}>
          <LowStockSection />
        </Suspense>

        <Suspense fallback={<ChartSkeleton h={220} />}>
          <TopFiveSection />
        </Suspense>

        <Suspense fallback={<ChartSkeleton h={300} />}>
          <RecentSalesActivity />
        </Suspense>

        <Suspense fallback={<ChartSkeleton h={300} />}>
          <BusinessFeedSection />
        </Suspense>

        <Suspense fallback={null}>
          <WebhookOrdersSection />
        </Suspense>

        <Suspense fallback={null}>
          <SyncHealthSection />
        </Suspense>

        <Suspense fallback={null}>
          <DashboardEmptyState />
        </Suspense>
      </div>
    </div>
  );
}
