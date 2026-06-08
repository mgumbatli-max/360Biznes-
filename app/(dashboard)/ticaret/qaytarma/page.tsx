import type { Metadata } from "next";
import Link from "next/link";
import {
  Undo2,
  Clock,
  CheckCircle2,
  TrendingDown,
  ScanBarcode,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { ReturnAnalyticsPanel } from "@/features/ticaret/components/return-analytics";
import { ErrorSilentWrapper } from "@/components/error-silent-wrapper";
import { ReturnFilters } from "@/features/qaytarma/components/return-filters";
import { NewReturnDialog } from "@/features/qaytarma/components/new-return-dialog";
import { ReturnsTable } from "@/features/qaytarma/components/returns-table";
import {
  getReturns,
  getReturnStats,
  getReturnFilterOptions,
  type ReturnFilter,
} from "@/features/qaytarma/queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Qaytarmalar" };

type SearchParams = {
  q?: string;
  nov?: string;
  status?: string;
  kontragent?: string;
  anbar?: string;
  from?: string;
  to?: string;
};

export default async function QaytarmaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { requireTicaretPerm } = await import("@/features/ticaret/access-guard");
  await requireTicaretPerm("qaytarma.oxu");

  const sp = await searchParams;

  const filter: ReturnFilter = {
    search: sp.q,
    nov: sp.nov === "satis_qaytarma" || sp.nov === "alis_qaytarma" ? sp.nov : undefined,
    status: sp.status || undefined,
    kontragent_id: sp.kontragent || undefined,
    anbar_id: sp.anbar ? Number(sp.anbar) : undefined,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
  };

  const [rows, stats, opts] = await Promise.all([
    getReturns(filter),
    getReturnStats(),
    getReturnFilterOptions(),
  ]);

  const exportQs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v) exportQs.set(k, String(v));
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Qaytarmalar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Müştərinin və ya təchizatçının qaytardığı məhsullar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/api/ticaret/qaytarma-export${exportQs.toString() ? `?${exportQs.toString()}` : ""}`} target="_blank">
              <FileSpreadsheet className="h-4 w-4" />
              Excel ixrac
            </Link>
          </Button>
          <Link
            href="/ticaret/qaytarma/tez"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-secondary"
          >
            <ScanBarcode className="h-4 w-4" />
            Tez qaytarma
          </Link>
          <NewReturnDialog
            anbarlar={opts.anbarlar}
            musteriler={opts.musteriler}
            mehsullar={opts.mehsullar}
          />
        </div>
      </header>

      <TicaretSubNav active="/ticaret/qaytarma" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={TrendingDown}
          label="Bu ay"
          value={formatMoney(stats.bu_ay_mebleg)}
          subline={`${stats.bu_ay_count} qaytarma`}
          tone={stats.bu_ay_mebleg > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={Clock}
          label="Gözləyən"
          value={String(stats.gozleyen)}
          subline="Təsdiq tələb edir"
          tone={stats.gozleyen > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Tamamlanan"
          value={String(stats.tamamlanan)}
          subline="Tarixdə"
          tone="success"
        />
        <KpiCard icon={Undo2} label="Cəm" value={String(rows.length)} subline="Filtrə uyğun" />
      </section>

      {/* AI Analitika — top problemli məhsul + səbəblər */}
      <ErrorSilentWrapper name="return-analytics">
        <ReturnAnalyticsPanel />
      </ErrorSilentWrapper>

      <ReturnFilters anbarlar={opts.anbarlar} musteriler={opts.musteriler} />

      <ReturnsTable rows={rows} />
    </div>
  );
}
