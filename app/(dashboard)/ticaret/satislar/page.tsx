import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart, TrendingUp, Calendar, CalendarRange, AlertCircle, FileSpreadsheet, LayoutGrid, List, Zap, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { SaleFilters } from "@/features/ticaret/components/sale-filters";
import { SalesTable } from "@/features/ticaret/components/sales-table";
import { PipelineBoard } from "@/features/ticaret/components/pipeline-board";
import { getSaleStats, getSales, type SaleFilter } from "@/features/ticaret/satis-queries";
import { getSalesByPipelineStage } from "@/features/ticaret/pipeline-queries";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { formatMoney } from "@/lib/utils";
import { SavedUrlFiltersChip } from "@/features/elaqe/components/saved-url-filters-chip";
import { RecordStatusFilter } from "@/components/ui/record-status-filter";

export const metadata: Metadata = { title: "Satışlar" };

type SearchParams = {
  q?: string;
  status?: string | string[];
  odenis?: string | string[];
  from?: string;
  to?: string;
  borc?: string;
  view?: string;
};

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

async function StatsKpis() {
  const stats = await getSaleStats();
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        icon={TrendingUp}
        label="Bugün"
        value={formatMoney(stats.bugun.mebleg)}
        subline={`${stats.bugun.count} sifariş`}
        tone="success"
      />
      <KpiCard icon={Calendar} label="Bu həftə" value={formatMoney(stats.bu_hefte.mebleg)} subline={`${stats.bu_hefte.count} sifariş`} />
      <KpiCard icon={CalendarRange} label="Bu ay" value={formatMoney(stats.bu_ay.mebleg)} subline={`${stats.bu_ay.count} sifariş`} />
      <KpiCard
        icon={AlertCircle}
        label="Ödənilməmiş qalıq"
        value={formatMoney(stats.borc_mebleg)}
        subline="Müştəri borcu"
        tone={stats.borc_mebleg > 0 ? "warning" : "neutral"}
      />
    </section>
  );
}

function StatsKpisSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </section>
  );
}

function SalesTableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full rounded-md" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-md" />
      ))}
    </div>
  );
}

async function SalesContent({
  filter,
  canPay,
  canCancel,
}: {
  filter: SaleFilter;
  canPay: boolean;
  canCancel: boolean;
}) {
  const sales = await getSales(filter);
  return (
    <SalesTable
      items={sales.items}
      total={sales.total}
      canPay={canPay}
      canCancel={canCancel}
    />
  );
}

async function PipelineContent() {
  const pipeline = await getSalesByPipelineStage(30);
  return <PipelineBoard columns={pipeline} />;
}

export default async function SatislarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { requireTicaretPerm } = await import("@/features/ticaret/access-guard");
  const { icazeler, isOwnerOrAdmin } = await requireTicaretPerm("satis.oxu");
  const canPay = isOwnerOrAdmin || icazeler.includes("satis.odenis") || icazeler.includes("satis.idare");
  const canCancel = isOwnerOrAdmin || icazeler.includes("satis.legv") || icazeler.includes("satis.idare");

  const sp = await searchParams;

  // SOFT-DELETE STANDARTI: URL-dən filter oxu + icazə yoxla
  const { readRecordStatusFromSearch } = await import("@/lib/soft-delete/record-filter");
  const { filter: recordStatus, canSeeDeleted } = await readRecordStatusFromSearch(
    sp as Record<string, string | string[] | undefined>,
  );

  const filter: SaleFilter = {
    search: sp.q,
    status: asArray(sp.status),
    odenis_nov: asArray(sp.odenis),
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
    borc: sp.borc === "var" || sp.borc === "yox" ? sp.borc : undefined,
    recordStatus,
  };

  const isKanban = sp.view === "kanban";

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Satışlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bütün satış sifarişləri. Yeni satış üçün POS-a keçin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RecordStatusFilter canSeeDeleted={canSeeDeleted} />
          <SavedUrlFiltersChip storageKey="satislar" basePath="/ticaret/satislar" />
          <Button asChild size="sm" variant="outline">
            <Link href="/api/ticaret/satis-export" target="_blank">
              <FileSpreadsheet className="h-4 w-4" />
              Excel ixrac
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/pos" target="_blank" rel="noopener">
              <ShoppingCart className="h-4 w-4" />
              POS
            </Link>
          </Button>
          {/* «Yeni əməliyyat» düyməsi indi TicaretSubNav-da sabit görünür */}
        </div>
      </header>

      <TicaretSubNav active="/ticaret/satislar" />

      {/* POS vs B2B aydınlaşdırma — yalnız list görünüşündə (kanban-da yer tutmasın) */}
      {!isKanban && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/pos"
            target="_blank"
            rel="noopener"
            className="group flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 transition hover:border-emerald-500/50 hover:bg-emerald-500/10"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Zap className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">POS (sürətli pərakəndə)</div>
              <div className="text-[11px] text-muted-foreground">
                Mağazada müştəri qarşısında — skan, ödəniş, çek bir ekrandan
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-emerald-600 transition group-hover:translate-x-1" />
          </Link>

          <Link
            href="/ticaret/satis-yeni"
            className="group flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 transition hover:border-primary/50 hover:bg-primary/10"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">Yeni satış (B2B sənəd)</div>
              <div className="text-[11px] text-muted-foreground">
                Formal sifariş — müştəri rekvizitləri, qaralama, çatdırılma, kreditli ödəniş
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary transition group-hover:translate-x-1" />
          </Link>
        </div>
      )}

      <Suspense fallback={<StatsKpisSkeleton />}>
        <StatsKpis />
      </Suspense>

      {/* View toggle — Cədvəl vs Kanban (pipeline board) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-0.5">
          <Link
            href={(() => {
              const params = new URLSearchParams();
              if (sp.q) params.set("q", sp.q);
              if (sp.from) params.set("from", sp.from);
              if (sp.to) params.set("to", sp.to);
              return `/ticaret/satislar${params.toString() ? `?${params.toString()}` : ""}`;
            })()}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              !isKanban ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Cədvəl
          </Link>
          <Link
            href="/ticaret/satislar?view=kanban"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              isKanban ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
          </Link>
        </div>
        {isKanban && (
          <span className="text-[11px] text-muted-foreground">
            Son 30 günün satışlarını mərhələyə görə görsənir
          </span>
        )}
      </div>

      {isKanban ? (
        <Suspense fallback={<SalesTableSkeleton />}>
          <PipelineContent />
        </Suspense>
      ) : (
        <>
          <SaleFilters />
          <Suspense fallback={<SalesTableSkeleton />}>
            <SalesContent filter={filter} canPay={canPay} canCancel={canCancel} />
          </Suspense>
        </>
      )}
    </div>
  );
}
