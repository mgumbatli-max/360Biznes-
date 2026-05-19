import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Repeat, MapPin, AlertCircle } from "lucide-react";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/features/hesabatlar/components/date-range-filter";
import { HorizontalBarChart, PiePaymentChart } from "@/features/hesabatlar/components/charts";
import {
  getTopCustomersLtv,
  getNewReturning,
  getGeoDistribution,
  getCustomerPaymentPref,
  getDebtBuckets,
  getSimpleCohort,
  type CustomerSegment,
} from "@/features/hesabatlar/musteri-queries";
import { parseDateRange, formatDateInput } from "@/features/hesabatlar/shared";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Müştəri hesabatı" };
export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = { negd: "Nağd", kart: "Kart", kecirme: "Bank köçürmə", nisye: "Nisyə" };

type SP = { from?: string; to?: string; preset?: string; segment?: string };

const SEGMENTS: { value: CustomerSegment; label: string }[] = [
  { value: "all", label: "Hamısı" },
  { value: "vip", label: "VIP (top 10% LTV)" },
  { value: "aktiv", label: "Aktiv (son 90 gün)" },
  { value: "yatmis", label: "Yatmış (90+ gün)" },
  { value: "borclu", label: "Borclu" },
];

export default async function MusteriReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const range = parseDateRange(sp);
  const segment: CustomerSegment = (SEGMENTS.find((s) => s.value === sp.segment)?.value ?? "all") as CustomerSegment;

  const [top, stats, geo, payPref, debt, cohort] = await Promise.all([
    getTopCustomersLtv(range, 50, segment),
    getNewReturning(range),
    getGeoDistribution(15),
    getCustomerPaymentPref(range),
    getDebtBuckets(),
    getSimpleCohort(6),
  ]);

  const exportParams = new URLSearchParams({ segment });

  const returnRate = stats.total > 0 ? (stats.returning_count / stats.total) * 100 : 0;
  const debtTotal = debt.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Müştəri hesabatı</h1>
        <p className="mt-1 text-sm text-muted-foreground">LTV, yeni vs təkrar, cohort, geo və borc analizi.</p>
      </header>

      <DateRangeFilter
        base="/hesabatlar/musteri"
        current={{ from: formatDateInput(range.from), to: formatDateInput(range.to), preset: sp.preset }}
      />

      {/* Segment filter + export */}
      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/30 p-3"
        data-section="customer-segment-filter"
      >
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}
        {sp.preset && <input type="hidden" name="preset" value={sp.preset} />}
        <label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Müştəri qrupu:</label>
        <select
          name="segment"
          defaultValue={segment}
          data-segment-select="1"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="submit" className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Filtrlə</button>
        <a
          href={`/api/hesabatlar/musteri/export?${exportParams.toString()}`}
          className="h-9 inline-flex items-center rounded-md border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary"
          data-customer-csv-export="1"
        >
          CSV ixrac (broadcast)
        </a>
      </form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Users} label="Cəm müştəri" value={String(stats.total)} subline="Aktiv qeydlər" />
        <KpiCard icon={TrendingUp} label="Bu dövrdə aktiv" value={String(stats.active_in_period)} subline="Sifariş edən" tone="success" />
        <KpiCard icon={Repeat} label="Təkrar alıcı" value={String(stats.returning_count)} subline={`${returnRate.toFixed(1)}% nisbət`} tone="info" />
        <KpiCard icon={Users} label="Yeni müştəri" value={String(stats.new_count)} subline="İlk dəfə qeydiyyat" />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-info" />
              Geo paylanma (şəhər üzrə)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={geo.map((g) => ({ label: g.sheher, value: g.ltv, sub: g.sayi }))} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ödəniş üstünlüyü</CardTitle>
          </CardHeader>
          <CardContent>
            <PiePaymentChart data={payPref.map((p) => ({ name: PAYMENT_LABELS[p.odenis_nov] ?? p.odenis_nov, value: p.amount }))} />
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-warning" />
            Borc analizi (yaş bucket)
          </CardTitle>
          <p className="text-xs text-muted-foreground">Cəm borc: <span className="font-semibold tabular-nums">{formatMoney(debtTotal)}</span></p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(["0-30", "31-60", "61-90", "90+"] as const).map((b) => {
              const row = debt.find((d) => d.bucket === b);
              const tone = b === "0-30" ? "border-success/30 bg-success/10" : b === "31-60" ? "border-warning/30 bg-warning/10" : b === "61-90" ? "border-warning/40 bg-warning/15" : "border-danger/30 bg-danger/10";
              return (
                <div key={b} className={`rounded-md border ${tone} p-3`}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{b} gün</div>
                  <div className="mt-1 text-xl font-bold tabular-nums">{formatMoney(row?.amount ?? 0)}</div>
                  <div className="text-xs text-muted-foreground">{row?.count ?? 0} müştəri</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Cohort analizi (son 6 ay)</CardTitle>
          <p className="text-xs text-muted-foreground">Hər ayın ilk alıcılarının bu ay yenidən alış nisbəti</p>
        </CardHeader>
        <CardContent className="p-0">
          {cohort.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cohort məlumatı yoxdur</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Cohort (ilk alış ayı)</th>
                  <th className="px-3 py-2 text-right">Cohort ölçüsü</th>
                  <th className="px-3 py-2 text-right">Bu ay qayıdan %</th>
                </tr>
              </thead>
              <tbody>
                {cohort.map((c) => (
                  <tr key={c.cohort} className="border-b border-border/30">
                    <td className="px-3 py-2 font-mono">{c.cohort}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.cohort_size}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`tabular-nums text-xs font-medium ${c.returned_pct >= 30 ? "text-success" : c.returned_pct >= 10 ? "text-warning" : "text-muted-foreground"}`}>
                        {c.returned_pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Top 50 müştəri (LTV)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {top.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Müştəri</th>
                    <th className="px-3 py-2">Şəhər</th>
                    <th className="px-3 py-2 text-right">Sifariş</th>
                    <th className="px-3 py-2 text-right">Dövr</th>
                    <th className="px-3 py-2 text-right">LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((c, i) => (
                    <tr key={c.id} className="border-b border-border/30">
                      <td className="px-3 py-2 text-xs tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.ad}</div>
                        {c.telefon && <div className="text-[10px] text-muted-foreground">{c.telefon}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{c.sheher ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.orders}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(c.revenue_period)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(c.ltv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
