import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes, AlertTriangle, PackageX, Activity, Clock } from "lucide-react";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { HorizontalBarChart, InOutLineChart } from "@/features/hesabatlar/components/charts";
import {
  getStockByWarehouse,
  getStockByCategory,
  getStockMovement30,
  getStockCounters,
  getStockAging,
} from "@/features/hesabatlar/stok-queries";
import { getReorderList } from "@/features/hesabatlar/mehsul-queries";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Stok hesabatı" };
export const dynamic = "force-dynamic";

export default async function StokReportPage() {
  const [byAnbar, byCat, movement, counters, reorder, aging] = await Promise.all([
    getStockByWarehouse(),
    getStockByCategory(),
    getStockMovement30(),
    getStockCounters(),
    getReorderList(50),
    getStockAging(),
  ]);
  const agingTotal = aging.son_30 + aging.gun_30_60 + aging.gun_60_90 + aging.yas_90_plus;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Stok hesabatı</h1>
        <p className="mt-1 text-sm text-muted-foreground">Anbar/kateqoriya dəyər, hərəkət və reorder.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Boxes} label="Cəm dəyər" value={formatMoney(counters.total_value)} subline={`${counters.product_count} məhsul`} tone="success" />
        <KpiCard icon={Activity} label="Sürətli" value={String(counters.fast_count)} subline="Son 30 gün satılıb" tone="success" />
        <KpiCard icon={PackageX} label="Yavaş / Ölü" value={`${counters.slow_count} / ${counters.dead_count}`} subline="30-90 gün / 90+ gün" tone="warning" />
        <KpiCard icon={AlertTriangle} label="Reorder" value={String(counters.reorder_count)} subline="Min stok altı" tone={counters.reorder_count > 0 ? "danger" : "neutral"} />
      </section>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-info" />
            Stok yaşlanması
          </CardTitle>
          <p className="text-xs text-muted-foreground">Son satışdan keçən günlər üzrə məhsul sayı</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <div className="rounded-md border border-success/30 bg-success/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-success">Son 30 gün</div>
              <div className="mt-1 text-xl font-bold tabular-nums">{aging.son_30}</div>
            </div>
            <div className="rounded-md border border-info/30 bg-info/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-info">30-60 gün</div>
              <div className="mt-1 text-xl font-bold tabular-nums">{aging.gun_30_60}</div>
            </div>
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-warning">60-90 gün</div>
              <div className="mt-1 text-xl font-bold tabular-nums">{aging.gun_60_90}</div>
            </div>
            <div className="rounded-md border border-danger/30 bg-danger/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-danger">90+ gün (ölü)</div>
              <div className="mt-1 text-xl font-bold tabular-nums">{aging.yas_90_plus}</div>
            </div>
            <div className="rounded-md border border-danger/40 bg-danger/15 p-3">
              <div className="text-[10px] uppercase tracking-wider text-danger">Dondurulan maya</div>
              <div className="mt-1 text-base font-bold tabular-nums">{formatMoney(aging.olu_maya)}</div>
            </div>
          </div>
          {agingTotal > 0 && (
            <div className="mt-3 flex h-2 overflow-hidden rounded-md bg-secondary/30">
              <div title={`Son 30 gün: ${aging.son_30}`} className="bg-success" style={{ width: `${(aging.son_30 / agingTotal) * 100}%` }} />
              <div title={`30-60 gün: ${aging.gun_30_60}`} className="bg-info" style={{ width: `${(aging.gun_30_60 / agingTotal) * 100}%` }} />
              <div title={`60-90 gün: ${aging.gun_60_90}`} className="bg-warning" style={{ width: `${(aging.gun_60_90 / agingTotal) * 100}%` }} />
              <div title={`90+ gün: ${aging.yas_90_plus}`} className="bg-danger" style={{ width: `${(aging.yas_90_plus / agingTotal) * 100}%` }} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stok hərəkəti (son 30 gün)</CardTitle>
          <p className="text-xs text-muted-foreground">Mədaxil (alış, qaytarma) vs Məxaric (satış, transfer)</p>
        </CardHeader>
        <CardContent>
          <InOutLineChart data={movement} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-base">Anbar üzrə dəyər</CardTitle></CardHeader>
          <CardContent>
            <HorizontalBarChart data={byAnbar.slice(0, 10).map((a) => ({ label: a.anbar_ad, value: a.value, sub: a.qty }))} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-base">Kateqoriya üzrə dəyər</CardTitle></CardHeader>
          <CardContent>
            <HorizontalBarChart data={byCat.slice(0, 10).map((c) => ({ label: c.kateqoriya_ad, value: c.value, sub: c.qty }))} />
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Yenidən sifariş lazımdır
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reorder.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Reorder lazım deyil 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Məhsul</th>
                    <th className="px-3 py-2 text-right">Stok</th>
                    <th className="px-3 py-2 text-right">Min</th>
                    <th className="px-3 py-2 text-right">Çatışmaz</th>
                  </tr>
                </thead>
                <tbody>
                  {reorder.map((r) => (
                    <tr key={r.mehsul_id} className="border-b border-border/30">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.ad}</div>
                        {r.kod && <div className="text-[10px] font-mono text-muted-foreground">{r.kod}</div>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-warning">{formatNumber(r.stok, 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatNumber(r.min_stok, 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-danger">{formatNumber(Math.max(0, r.min_stok - r.stok), 0)}</td>
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
