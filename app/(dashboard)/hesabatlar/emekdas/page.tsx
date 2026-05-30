import type { Metadata } from "next";
import { Users, TrendingUp, Award, CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { DateRangeFilter } from "@/features/hesabatlar/components/date-range-filter";
import { HorizontalBarChart } from "@/features/hesabatlar/components/charts";
import { getStaffPerformance, getAttendanceStats } from "@/features/hesabatlar/emekdas-queries";
import { parseDateRange, formatDateInput } from "@/features/hesabatlar/shared";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Əməkdaş hesabatı" };

type SP = { from?: string; to?: string; preset?: string };

export default async function EmekdasReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const range = parseDateRange(sp);

  const [perf, attendance] = await Promise.all([
    getStaffPerformance(range, 50),
    getAttendanceStats(range),
  ]);

  const active = perf.filter((u) => u.sifaris_say > 0);
  const totalRev = active.reduce((s, u) => s + u.cemi, 0);
  const totalEndirim = active.reduce((s, u) => s + u.endirim, 0);
  const totalSalary = perf.reduce((s, u) => s + (u.aylik_maas ?? 0), 0);
  const avgCheck = active.length > 0 ? totalRev / active.reduce((s, u) => s + u.sifaris_say, 0) : 0;
  const endirimPct = totalRev > 0 ? (totalEndirim / totalRev) * 100 : 0;
  const totalRoi = totalSalary > 0 ? totalRev / totalSalary : 0;

  const byAttendance = new Map(attendance.map((a) => [a.id, a]));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Əməkdaş performansı</h1>
        <p className="mt-1 text-sm text-muted-foreground">Satıcı ranking, davamiyyət və maaş paylanması.</p>
      </header>

      <DateRangeFilter
        base="/hesabatlar/emekdas"
        current={{ from: formatDateInput(range.from), to: formatDateInput(range.to), preset: sp.preset }}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard icon={Users} label="Aktiv satıcı" value={String(active.length)} subline={`${perf.length} cəm işçi`} />
        <KpiCard icon={TrendingUp} label="Cəm satış" value={formatMoney(totalRev)} tone="success" />
        <KpiCard icon={Award} label="Orta çek" value={formatMoney(avgCheck)} subline="Sifariş başına" />
        <KpiCard icon={CalendarCheck} label="Cəm maaş" value={formatMoney(totalSalary)} subline="Aylıq maaş cəmi" />
        <KpiCard icon={TrendingUp} label="Endirim %" value={`${endirimPct.toFixed(1)}%`} subline={`${formatMoney(totalEndirim)} cəm endirim`} tone="warning" />
        <KpiCard icon={Award} label="ROI (dövriyyə÷maaş)" value={`${totalRoi.toFixed(1)}×`} subline="Komanda effektivliyi" tone={totalRoi >= 5 ? "success" : totalRoi >= 3 ? "info" : "warning"} />
      </section>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 10 satıcı (cəmi)</CardTitle>
        </CardHeader>
        <CardContent>
          <HorizontalBarChart data={active.slice(0, 10).map((u) => ({ label: u.ad, value: u.cemi, sub: u.sifaris_say }))} />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Əməkdaş ranking və davamiyyət</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">İşçi</th>
                  <th className="px-3 py-2">Vəzifə</th>
                  <th className="px-3 py-2 text-right">Sifariş</th>
                  <th className="px-3 py-2 text-right">Cəmi</th>
                  <th className="px-3 py-2 text-right">Endirim</th>
                  <th className="px-3 py-2 text-right">Endirim %</th>
                  <th className="px-3 py-2 text-right">Orta çek</th>
                  <th className="px-3 py-2 text-right">Davamiyyət</th>
                  <th className="px-3 py-2 text-right">Maaş · ROI</th>
                </tr>
              </thead>
              <tbody>
                {perf.map((u, i) => {
                  const att = byAttendance.get(u.id);
                  const roiCls = u.roi >= 5 ? "text-success" : u.roi >= 3 ? "text-info" : "text-warning";
                  const rankBadge = i < 3
                    ? <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-warning/20 text-warning" : i === 1 ? "bg-info/20 text-info" : "bg-secondary text-foreground"}`}>{i + 1}</span>
                    : <span className="inline-block w-5 text-center text-xs text-muted-foreground">{i + 1}</span>;
                  return (
                    <tr key={u.id} className="border-b border-border/30">
                      <td className="px-3 py-2">{rankBadge}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-secondary text-[10px]">
                              {u.ad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.ad}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{u.vezife ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.sifaris_say}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(u.cemi)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-warning">{formatMoney(u.endirim)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-warning">{u.endirim_pct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(u.ort_cek)}</td>
                      <td className="px-3 py-2 text-right">
                        {att ? (
                          <span className={`tabular-nums text-xs ${att.davamiyyet_pct >= 90 ? "text-success" : att.davamiyyet_pct >= 70 ? "text-warning" : "text-danger"}`}>
                            {att.davamiyyet_pct.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                        {u.aylik_maas != null ? formatMoney(u.aylik_maas) : "—"}
                        {u.aylik_maas != null && u.roi > 0 && (
                          <span className={`ml-1.5 inline-block rounded px-1 py-0.5 text-[10px] font-medium ${roiCls} bg-secondary/30`}>{u.roi.toFixed(1)}×</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {perf.length === 0 && (
                  <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Məlumat yoxdur</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

void formatNumber;
