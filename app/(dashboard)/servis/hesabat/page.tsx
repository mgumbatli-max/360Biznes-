import type { Metadata } from "next";
import { CircleDollarSign, TrendingDown, Percent, Users } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import {
  getServisHesabat,
  getCycleTimeByMonth,
  getBottleneckAnalysis,
  getCostVsRevenue,
  getDefektKateqDist,
  getCustomerSourceSplit,
} from "@/features/servis/queries";
import { TopFailChart, TrendChart, TechPerfChart } from "@/features/servis/components/hesabat-charts";
import {
  CycleTimeChart,
  BottleneckChart,
  CostRevenueChart,
  DefektPieChart,
  SourceSplitChart,
} from "@/features/servis/components/extra-charts";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Servis hesabatı" };

export default async function ServisHesabatPage() {
  const { requireServisPerm } = await import("@/features/servis/access-guard");
  await requireServisPerm();

  const [data, cycle, bottleneck, costRev, defekt, source] = await Promise.all([
    getServisHesabat(),
    getCycleTimeByMonth(),
    getBottleneckAnalysis(),
    getCostVsRevenue(),
    getDefektKateqDist(),
    getCustomerSourceSplit(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/servis" className="mt-1" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Servis hesabatı</h1>
          <p className="mt-1 text-sm text-muted-foreground">Texniki performans, defekt analizi və müştəri qayıdışı.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={CircleDollarSign} label="Cəmi gəlir" value={formatMoney(data.gelir)} tone="success" />
        <KpiCard icon={TrendingDown} label="Hissə xərci" value={formatMoney(data.xerc)} tone="warning" />
        <KpiCard icon={Percent} label="Marja" value={`${data.marja}%`} tone="info" />
        <KpiCard icon={Users} label="Gecikmə dərəcəsi" value={`${data.gecikme_faiz}%`} subline={`${data.gecikme} sifariş`} tone={data.gecikme_faiz > 20 ? "danger" : "neutral"} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Aylıq trend (son 6 ay)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={data.trend} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ən çox xarab olan məhsullar (top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <TopFailChart data={data.topFail.map((t) => ({ mehsul_ad: t.mehsul_ad, say: t.say }))} />
          </CardContent>
        </Card>
      </div>

      {/* B5: Yeni KPI chart-lar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cycle time — orta qəbul → təhvil (gün, son 12 ay)</CardTitle>
          </CardHeader>
          <CardContent>
            <CycleTimeChart data={cycle} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bottleneck — hər status-da ortalama keçən saat</CardTitle>
          </CardHeader>
          <CardContent>
            <BottleneckChart data={bottleneck} />
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cost vs Revenue — son 30 servis</CardTitle>
        </CardHeader>
        <CardContent>
          <CostRevenueChart data={costRev} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top failing defekt kateqoriyaları</CardTitle>
          </CardHeader>
          <CardContent>
            <DefektPieChart data={defekt} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Müştəri qaynaq analizi — ilk dəfə vs təkrar</CardTitle>
          </CardHeader>
          <CardContent>
            <SourceSplitChart data={source} />
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Texniki performans — müqayisəli qrafik</CardTitle>
        </CardHeader>
        <CardContent>
          <TechPerfChart data={data.tech.map((t) => ({ ad_soyad: t.ad_soyad, say: t.say, gelir: t.gelir, avg_gun: t.avg_gun }))} />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Texniki performans — cədvəl</CardTitle>
        </CardHeader>
        <CardContent>
          {data.tech.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Hələ məlumat yoxdur.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Texniki</th>
                    <th className="px-3 py-2.5 text-right">Sifariş sayı</th>
                    <th className="px-3 py-2.5 text-right">Orta təmir günü</th>
                    <th className="px-3 py-2.5 text-right">Cəmi gəlir</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tech.map((t, i) => (
                    <tr key={`${t.iscisi_id ?? "none"}-${i}`} className="border-b border-border/30 hover:bg-secondary/40">
                      <td className="px-3 py-2.5 font-medium">{t.ad_soyad}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{t.say}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{t.avg_gun} gün</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(t.gelir)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Qayıdan müştərilər (2+ servis)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.repeat.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Hələ qayıdan müştəri yoxdur.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Müştəri</th>
                    <th className="px-3 py-2.5">Telefon</th>
                    <th className="px-3 py-2.5 text-right">Servis sayı</th>
                  </tr>
                </thead>
                <tbody>
                  {data.repeat.map((r, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-secondary/40">
                      <td className="px-3 py-2.5">{r.musteri_ad}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.musteri_telefon}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.say}</td>
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
