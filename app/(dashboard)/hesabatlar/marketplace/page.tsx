import type { Metadata } from "next";
import { Store, TrendingUp, ShoppingCart, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { DateRangeFilter } from "@/features/hesabatlar/components/date-range-filter";
import { HorizontalBarChart } from "@/features/hesabatlar/components/charts";
import { getPlatformBreakdown, getTopProductsByPlatform } from "@/features/hesabatlar/marketplace-queries";
import { PlatformDrilldownTrigger } from "@/features/hesabatlar/components/platform-drilldown-modal";
import { parseDateRange, formatDateInput } from "@/features/hesabatlar/shared";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Marketplace hesabatı" };

type SP = { from?: string; to?: string; preset?: string };

export default async function MarketplaceReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const range = parseDateRange(sp);

  const [platforms, topProducts] = await Promise.all([
    getPlatformBreakdown(range),
    getTopProductsByPlatform(range, 5),
  ]);

  const totalOrders = platforms.reduce((s, p) => s + p.orders, 0);
  const totalBrut = platforms.reduce((s, p) => s + p.brut, 0);
  const totalKom = platforms.reduce((s, p) => s + p.komisyon, 0);
  const totalNet = platforms.reduce((s, p) => s + p.xalis, 0);
  const komRate = totalBrut > 0 ? (totalKom / totalBrut) * 100 : 0;

  // Group products by platform
  const byPlatform = topProducts.reduce<Record<string, typeof topProducts>>((acc, r) => {
    (acc[r.platform] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Marketplace hesabatı</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platforma üzrə komissiya, net və top məhsullar.</p>
      </header>

      <DateRangeFilter
        base="/hesabatlar/marketplace"
        current={{ from: formatDateInput(range.from), to: formatDateInput(range.to), preset: sp.preset }}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={ShoppingCart} label="Sifariş" value={formatNumber(totalOrders, 0)} subline={`${platforms.length} platforma`} />
        <KpiCard icon={TrendingUp} label="Brüt gəlir" value={formatMoney(totalBrut)} tone="success" />
        <KpiCard icon={Percent} label="Komissiya" value={formatMoney(totalKom)} subline={`${komRate.toFixed(1)}%`} tone="warning" />
        <KpiCard icon={Store} label="Net" value={formatMoney(totalNet)} subline="Komissiyadan sonra" tone="success" />
      </section>

      {platforms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Store className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Marketplace sifarişi yoxdur</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Platforma sifarişləri ERP-yə daxil edildikdə burada görünəcək.</p>
        </div>
      ) : (
        <>
          <Card className="glass">
            <CardHeader className="pb-2"><CardTitle className="text-base">Platforma müqayisəsi (brüt gəlir)</CardTitle></CardHeader>
            <CardContent>
              <HorizontalBarChart data={platforms.map((p) => ({ label: p.platform, value: p.brut, sub: p.orders }))} />
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2"><CardTitle className="text-base">Platforma detalları</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Platforma</th>
                    <th className="px-3 py-2 text-right">Sifariş</th>
                    <th className="px-3 py-2 text-right">Brüt</th>
                    <th className="px-3 py-2 text-right">Komissiya</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">% Kom</th>
                    <th className="px-3 py-2 text-right">Əməl</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p) => {
                    const rate = p.brut > 0 ? (p.komisyon / p.brut) * 100 : 0;
                    return (
                      <tr key={p.platform} className="border-b border-border/30">
                        <td className="px-3 py-2 capitalize font-medium">{p.platform}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.orders}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.brut)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-warning">{formatMoney(p.komisyon)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-success">{formatMoney(p.xalis)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{rate.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right">
                          <PlatformDrilldownTrigger
                            platform={p.platform}
                            from={formatDateInput(range.from)}
                            to={formatDateInput(range.to)}
                          >
                            Bax
                          </PlatformDrilldownTrigger>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Object.entries(byPlatform).map(([platform, items]) => (
              <Card key={platform} className="glass">
                <CardHeader className="pb-2"><CardTitle className="text-base capitalize">Top 5 məhsul — {platform}</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Məhsul</th>
                        <th className="px-3 py-2 text-right">Sayı</th>
                        <th className="px-3 py-2 text-right">Gəlir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={`${platform}-${it.mehsul_id}-${i}`} className="border-b border-border/30">
                          <td className="px-3 py-2 font-medium">{it.ad}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs">{formatNumber(it.satilan, 0)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(it.gelir)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
