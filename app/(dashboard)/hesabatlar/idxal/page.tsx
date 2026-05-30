import type { Metadata } from "next";
import { Truck, TrendingUp, Receipt, AlertTriangle, Building2, Wallet, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { DateRangeFilter } from "@/features/hesabatlar/components/date-range-filter";
import { HorizontalBarChart } from "@/features/hesabatlar/components/charts";
import { ViewToggle, SortLink, parseView } from "@/features/hesabatlar/components/view-toggle";
import { TedarukciBrick, BrickEmpty } from "@/features/hesabatlar/components/brick-cards";
import {
  getImportStats,
  getSupplierBreakdown,
  getImportStatusBreakdown,
} from "@/features/hesabatlar/idxal-queries";
import { parseDateRange, formatDateInput, rangeLabel } from "@/features/hesabatlar/shared";
import { formatMoney, formatNumber, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "İdxal/Alış hesabatı" };

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  gozlemede: { label: "Gözləmədə", cls: "border-warning/30 bg-warning/10 text-warning" },
  qebul_edildi: { label: "Qəbul edildi", cls: "border-success/30 bg-success/10 text-success" },
  legv: { label: "Ləğv", cls: "border-muted bg-muted/10 text-muted-foreground" },
};

type SP = {
  from?: string;
  to?: string;
  preset?: string;
  sup_view?: string;
  sort?: string;
  dir?: "asc" | "desc";
};

export default async function IdxalReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const range = parseDateRange(sp);

  const [stats, suppliers, byStatus] = await Promise.all([
    getImportStats(range),
    getSupplierBreakdown(range, 50),
    getImportStatusBreakdown(range),
  ]);

  const unpaid = stats.total_amount - stats.paid;
  const paidPct = stats.total_amount > 0 ? (stats.paid / stats.total_amount) * 100 : 0;
  const debtPct = stats.total_amount > 0 ? (unpaid / stats.total_amount) * 100 : 0;

  // Supplier concentration
  const topShare = suppliers[0]
    ? (suppliers[0].cemi / Math.max(stats.total_amount, 1)) * 100
    : 0;
  const top3Share = suppliers.slice(0, 3).reduce((s, x) => s + x.cemi, 0) / Math.max(stats.total_amount, 1) * 100;

  const supView = parseView(sp, "sup_view");
  const sortField = sp.sort ?? "cemi";
  const sortDir = sp.dir === "asc" ? "asc" : "desc";

  const sortedSuppliers = [...suppliers].sort((a, b) => {
    const f = sortField as keyof typeof a;
    const va = Number(a[f] ?? 0);
    const vb = Number(b[f] ?? 0);
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const spDict: Record<string, string | undefined> = {
    from: sp.from,
    to: sp.to,
    preset: sp.preset,
    sup_view: sp.sup_view,
    sort: sp.sort,
    dir: sp.dir,
  };
  const baseUrl = "/hesabatlar/idxal";

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">İdxal / Alış hesabatı</h1>
            <p className="text-sm text-muted-foreground">{rangeLabel(range)} — təchizatçı performansı, vergi/gömrük, borc analizi</p>
          </div>
        </div>
      </header>

      <DateRangeFilter
        base={baseUrl}
        current={{ from: formatDateInput(range.from), to: formatDateInput(range.to), preset: sp.preset }}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard icon={Truck} label="Sifariş sayı" value={String(stats.total_count)} subline="Bu dövrdə" />
        <KpiCard icon={TrendingUp} label="Cəm alış" value={formatMoney(stats.total_amount)} subline={`Orta: ${formatMoney(stats.total_count > 0 ? stats.total_amount / stats.total_count : 0)}`} tone="info" />
        <KpiCard icon={Wallet} label="Ödənilib" value={formatMoney(stats.paid)} subline={`${paidPct.toFixed(1)}% ödənilib`} tone="success" />
        <KpiCard icon={AlertTriangle} label="Qalıq borc" value={formatMoney(unpaid)} subline={`${debtPct.toFixed(1)}%`} tone={unpaid > 0 ? "warning" : "neutral"} />
        <KpiCard icon={Receipt} label="Vergi/Gömrük" value={formatMoney(stats.vergi_gomruk)} subline={`Əlavə: ${formatMoney(stats.elave_xerc)}`} tone="warning" />
        <KpiCard
          icon={Building2}
          label="Konsentrasiya"
          value={`${topShare.toFixed(0)}%`}
          subline={`Top 3: ${top3Share.toFixed(0)}%`}
          tone={topShare > 50 ? "warning" : "neutral"}
        />
      </section>

      {/* Payment health bar */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" />
            Ödəniş sağlamlığı
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex h-7 overflow-hidden rounded-lg border border-border/40">
            <div
              className="grid place-items-center bg-gradient-to-r from-emerald-500 to-teal-500 text-[10px] font-bold text-white"
              style={{ width: `${Math.max(0, paidPct)}%` }}
              title={`Ödənilib: ${formatMoney(stats.paid)}`}
            >
              {paidPct >= 8 && `${paidPct.toFixed(0)}% ödənilib`}
            </div>
            <div
              className="grid place-items-center bg-gradient-to-r from-rose-500 to-red-600 text-[10px] font-bold text-white"
              style={{ width: `${Math.max(0, debtPct)}%` }}
              title={`Qalıq borc: ${formatMoney(unpaid)}`}
            >
              {debtPct >= 8 && `${debtPct.toFixed(0)}% borc`}
            </div>
          </div>
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="inline-flex items-center gap-1.5 text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ödənilib: <span className="font-bold tabular-nums">{formatMoney(stats.paid)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-rose-500">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Borc: <span className="font-bold tabular-nums">{formatMoney(unpaid)}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Status + supplier volume chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-base">Status</CardTitle></CardHeader>
          <CardContent className="space-y-2 py-3">
            {byStatus.map((s) => {
              const st = STATUS_LABEL[s.status] ?? { label: s.status, cls: "border-border text-muted-foreground" };
              const sharePct = stats.total_count > 0 ? (s.count / stats.total_count) * 100 : 0;
              return (
                <div key={s.status} className="rounded-md border border-border/40 bg-secondary/30 p-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cn("text-[10px]", st.cls)}>{st.label}</Badge>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{s.count}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">{formatMoney(s.amount)}</div>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary/60">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${sharePct}%` }} />
                  </div>
                </div>
              );
            })}
            {byStatus.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>}
          </CardContent>
        </Card>

        <Card className="glass lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Təchizatçı üzrə həcm (top 10)</CardTitle>
            <p className="text-xs text-muted-foreground">Cəm alış məbləği bazasında</p>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={suppliers.slice(0, 10).map((s) => ({ label: s.sirket_adi ?? s.ad, value: s.cemi, sub: s.sayi }))} />
          </CardContent>
        </Card>
      </div>

      {/* Suppliers — toggle table/brick */}
      <Card className="glass">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Təchizatçılar (top 50)
            </CardTitle>
            <p className="text-xs text-muted-foreground">Sortlama: {sortField} {sortDir === "desc" ? "↓" : "↑"}</p>
          </div>
          <ViewToggle base={baseUrl} current={supView} searchParams={spDict} param="sup_view" />
        </CardHeader>
        <CardContent className={supView === "kerpic" ? "" : "p-0"}>
          {supView === "kerpic" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedSuppliers.length === 0 ? (
                <BrickEmpty icon={Truck} msg="Təchizatçı məlumatı yoxdur" />
              ) : (
                sortedSuppliers.map((s, i) => (
                  <TedarukciBrick
                    key={s.id}
                    rank={i + 1}
                    ad={s.ad}
                    sirket={s.sirket_adi}
                    orders={s.sayi}
                    total={s.cemi}
                    paid={s.odenilmis}
                    debt={s.borc}
                    last_order={s.son_sifaris ? new Date(s.son_sifaris) : null}
                    on_time_pct={s.vaxtinda_pct}
                  />
                ))
              )}
            </div>
          ) : sortedSuppliers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Təchizatçı</th>
                    <th className="px-3 py-2 text-right">
                      <SortLink base={baseUrl} searchParams={spDict} field="sayi" currentField={sortField} currentDir={sortDir}>Sifariş</SortLink>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <SortLink base={baseUrl} searchParams={spDict} field="cemi" currentField={sortField} currentDir={sortDir}>Cəmi</SortLink>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <SortLink base={baseUrl} searchParams={spDict} field="ortalama" currentField={sortField} currentDir={sortDir}>Orta sif.</SortLink>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <SortLink base={baseUrl} searchParams={spDict} field="odenilmis" currentField={sortField} currentDir={sortDir}>Ödənilib</SortLink>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <SortLink base={baseUrl} searchParams={spDict} field="borc" currentField={sortField} currentDir={sortDir}>Borc</SortLink>
                    </th>
                    <th className="px-3 py-2 text-right">Ödəniş %</th>
                    <th className="px-3 py-2 text-right">Son sifariş</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSuppliers.map((s, i) => {
                    const sPaidPct = s.cemi > 0 ? ((s.odenilmis ?? 0) / s.cemi) * 100 : 0;
                    return (
                      <tr key={s.id} className="border-b border-border/30 hover:bg-secondary/20">
                        <td className="px-3 py-2 text-xs tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{s.ad}</div>
                          {s.sirket_adi && <div className="text-[10px] text-muted-foreground">{s.sirket_adi}</div>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{formatNumber(s.sayi)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(s.cemi)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatMoney(s.ortalama ?? 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-emerald-500">{formatMoney(s.odenilmis ?? 0)}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", s.borc > 0 ? "text-rose-500" : "text-emerald-500")}>{formatMoney(s.borc)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="ml-auto flex w-24 items-center gap-1.5">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  sPaidPct >= 90 ? "bg-emerald-500" : sPaidPct >= 50 ? "bg-amber-500" : "bg-rose-500"
                                )}
                                style={{ width: `${Math.min(100, sPaidPct)}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-[10px] tabular-nums">{sPaidPct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-[10.5px] text-muted-foreground">
                          {s.son_sifaris ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Calendar className="h-2.5 w-2.5" />
                              {new Date(s.son_sifaris).toLocaleDateString("az-AZ", { day: "numeric", month: "short" })}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
