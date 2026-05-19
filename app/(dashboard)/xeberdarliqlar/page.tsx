import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Settings, ShieldAlert, Radar, ShieldCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/auth";
import { AlertStatsBar } from "@/features/alerts/components/alert-stats";
import { AlertFilters } from "@/features/alerts/components/alert-filters";
import { AlertCard } from "@/features/alerts/components/alert-card";
import { GroupedView } from "@/features/alerts/components/grouped-view";
import { AlertViewToggle, type AlertView } from "@/features/alerts/components/view-toggle";
import { MarkAllReadButton } from "@/features/alerts/components/mark-all-read";
import { NezaretMerkeziTabs } from "@/features/nezaret-merkezi/components/tabs";
import { getNezaretBadges } from "@/features/nezaret-merkezi/counts";
import {
  getAlertCategories,
  getAlertStats,
  getAlerts,
  getAlertsGrouped,
  type AlertFilter,
} from "@/features/alerts/queries";

export const metadata: Metadata = { title: "Xəbərdarlıqlar — Risk paneli" };
export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  seviyye?: string | string[];
  status?: string | string[];
  kateq?: string | string[];
  view?: string;
  page?: string;
};

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function XeberdarliqlarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) return null;

  const filter: AlertFilter = {
    search: sp.q,
    seviyye: asArray(sp.seviyye) as AlertFilter["seviyye"],
    status: asArray(sp.status) as AlertFilter["status"],
    kateqoriya_kod: asArray(sp.kateq),
    current_user_id: session.user.id,
  };
  const page = Number(sp.page ?? 1);
  const view: AlertView = (sp.view === "card" || sp.view === "group") ? sp.view : "list";

  const [stats, categories, tabBadges] = await Promise.all([
    getAlertStats(),
    getAlertCategories(),
    getNezaretBadges(),
  ]);

  // Load only what the active view needs
  const flatData = view !== "group" ? await getAlerts(filter, page, 25) : null;
  const groupedData = view === "group" ? await getAlertsGrouped(filter) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <NezaretMerkeziTabs current="xeberdarliqlar" badges={tabBadges} />

      {/* Hero header — risk/radar theme */}
      <header className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-rose-500/5 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 opacity-10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 shadow-lg shadow-amber-500/20">
              <Radar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Xəbərdarlıqlar — Risk paneli</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Bütün modullardan avtomatik aşkarlanan risklər, gecikmələr və uyğunsuzluqlar.
                <span className="font-semibold text-foreground"> Burada əməliyyat saxlanmır</span> — diqqət tələb edən
                problemlər göstərilir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MarkAllReadButton count={stats.open_count} />
            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
              <Link href="/ayarlar">
                <Settings className="h-3 w-3" /> Qaydalar
              </Link>
            </Button>
          </div>
        </div>

        {/* Difference banner */}
        <div className="relative mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
          <Info className="h-3.5 w-3.5 shrink-0 text-sky-500" />
          <span className="text-muted-foreground">
            Burada <strong className="text-amber-600 dark:text-amber-400">risk və problemlər</strong> göstərilir. Əməliyyatı bloklamır.
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            Sahibkar təsdiqi gözləyən əməliyyatlar üçün:
          </span>
          <Link
            href="/tesdiq"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
          >
            <ShieldCheck className="h-3 w-3" />
            Təsdiq Mərkəzi
          </Link>
        </div>
      </header>

      {/* Stats strip */}
      <AlertStatsBar stats={stats} />

      {/* View toggle + filter row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AlertViewToggle current={view} searchParams={sp} />
        <span className="text-xs text-muted-foreground">
          {view === "group" ? `${groupedData?.length ?? 0} kateqoriya` : `${flatData?.total ?? 0} xəbərdarlıq`}
        </span>
      </div>

      <AlertFilters
        categories={categories.map((c) => ({ kod: c.kod, ad: c.ad, emoji: c.emoji }))}
      />

      {/* Body — view-conditional */}
      {view === "group" && groupedData && <GroupedView groups={groupedData} />}

      {view === "card" && flatData && (
        flatData.items.length === 0 ? <EmptyState /> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {flatData.items.map((a) => <AlertCard key={a.id} alert={a} />)}
          </div>
        )
      )}

      {view === "list" && flatData && (
        flatData.items.length === 0 ? <EmptyState /> : (
          <div className="space-y-2">
            {flatData.items.map((a) => <AlertCard key={a.id} alert={a} />)}
          </div>
        )
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="glass">
      <CardContent className="py-16 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10">
          <Bell className="h-5 w-5 text-emerald-500" />
        </div>
        <h3 className="font-semibold">Bütün sistem sakit</h3>
        <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
          Cari filtrlərə uyğun açıq xəbərdarlıq yoxdur. Sistem bütün modulları izləyir — yeni problem aşkar edildikdə burada görünəcək.
        </p>
        <div className="mt-3 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-3 w-3" />
          Risk radar aktivdir
        </div>
      </CardContent>
    </Card>
  );
}
