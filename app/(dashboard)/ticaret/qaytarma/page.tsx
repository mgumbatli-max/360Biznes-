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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { ReturnAnalyticsPanel } from "@/features/ticaret/components/return-analytics";
import { ErrorSilentWrapper } from "@/components/error-silent-wrapper";
import { ReturnFilters } from "@/features/qaytarma/components/return-filters";
import { NewReturnDialog } from "@/features/qaytarma/components/new-return-dialog";
import { AcceptReturnButton } from "@/features/qaytarma/components/accept-return-button";
import { CancelReturnButton } from "@/features/qaytarma/components/cancel-return-button";
import { CustomerDrawer } from "@/features/elaqe/components/customer-drawer";
import {
  getReturns,
  getReturnStats,
  getReturnFilterOptions,
  type ReturnFilter,
} from "@/features/qaytarma/queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Qaytarmalar" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  tesdiqlenmemis: { label: "Gözləyir", cls: "bg-warning/15 text-warning border-warning/30" },
  tesdiqlendi: { label: "Təsdiqləndi", cls: "bg-info/15 text-info border-info/30" },
  tamamlandi: { label: "Tamamlandı", cls: "bg-success/15 text-success border-success/30" },
  legv: { label: "Ləğv", cls: "bg-muted text-muted-foreground border-border" },
};

const NOV: Record<string, string> = {
  satis_qaytarma: "Müştəri qaytarması",
  alis_qaytarma: "Təchizatçıya qaytarma",
};

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

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Undo2 className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Filtrə uyğun qaytarma yoxdur</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Yuxarıdakı <strong>Yeni qaytarma</strong> düyməsi ilə qaytarma yaradın və ya filtrləri sıfırlayın.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Nömrə / Tarix</th>
                <th className="px-3 py-2.5">Növ</th>
                <th className="px-3 py-2.5">Kontragent</th>
                <th className="px-3 py-2.5">Anbar</th>
                <th className="px-3 py-2.5">Səbəb</th>
                <th className="px-3 py-2.5 text-center">Sətr</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Məbləğ</th>
                <th className="px-3 py-2.5 text-right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = STATUS[r.status] ?? STATUS.tesdiqlenmemis;
                return (
                  <tr key={r.id} className="border-b border-border/30 transition hover:bg-secondary/40">
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs font-medium">{r.nomre}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(r.tarix)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{NOV[r.nov] ?? r.nov}</td>
                    <td className="px-3 py-2.5">
                      {r.kontragent_id && r.kontragent_ad ? (
                        <CustomerDrawer customerId={r.kontragent_id}>
                          <button type="button" className="text-left text-sm transition hover:text-primary hover:underline">
                            {r.kontragent_ad}
                          </button>
                        </CustomerDrawer>
                      ) : (
                        r.kontragent_ad ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.anbar_ad ?? "—"}</td>
                    <td
                      className="max-w-[200px] truncate px-3 py-2.5 text-xs text-muted-foreground"
                      title={r.sebeb ?? undefined}
                    >
                      {r.sebeb ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-xs">{r.satir_say}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={s.cls}>{s.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      {formatMoney(r.umumi_mebleg)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {r.status === "tesdiqlenmemis" && (
                        <div className="inline-flex items-center gap-1">
                          <AcceptReturnButton id={r.id} nomre={r.nomre} />
                          <CancelReturnButton id={r.id} nomre={r.nomre} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
