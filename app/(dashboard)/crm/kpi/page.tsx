import type { Metadata } from "next";
import { BarChart3, Trophy, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CrmSubNav } from "@/components/crm-subnav";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { getUserKpi, getCrmKpiSummary, type KpiRange } from "@/features/crm/kpi-queries";
import { formatMoney } from "@/lib/utils";
import { KpiRangeTabs } from "@/features/crm/components/kpi-range-tabs";

export const metadata: Metadata = { title: "CRM KPI" };

type SearchParams = Promise<{ range?: string }>;

export default async function CrmKpiPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const range: KpiRange = (sp.range as KpiRange) ?? "month";
  const [users, summary] = await Promise.all([getUserKpi(range), getCrmKpiSummary(range)]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <CrmSubNav active="/crm/kpi" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> CRM KPI
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Məsul üzrə performans, çevrilmə nisbəti və leaderboard.
          </p>
        </div>
        <KpiRangeTabs current={range} />
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Users} label="Yeni lead" value={String(summary.yeni_lead)} subline="Bu dövr" />
        <KpiCard icon={Trophy} label="Qazanıldı" value={String(summary.qazandi)} subline={`${summary.cevrilme.toFixed(1)}% konversiya`} tone="success" />
        <KpiCard icon={TrendingUp} label="Cəm dəyər" value={formatMoney(summary.cem_deyer)} subline="Qazanılan deals" />
        <KpiCard icon={TrendingUp} label="Ortalama deal" value={formatMoney(summary.ortalama_deal)} subline="Per müştəri" />
      </section>

      <Card className="glass">
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Bu dövr üçün məsul KPI tapılmadı
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40">
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 w-10">#</th>
                    <th className="px-3 py-2">Məsul</th>
                    <th className="px-3 py-2 text-right">Yeni lead</th>
                    <th className="px-3 py-2 text-right">Qazandı</th>
                    <th className="px-3 py-2 text-right">İtirdi</th>
                    <th className="px-3 py-2 text-right">Çevrilmə</th>
                    <th className="px-3 py-2 text-right">Ortalama deal</th>
                    <th className="px-3 py-2 text-right">Müddət (gün)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {users.map((u, i) => (
                    <tr key={u.user_id} className="hover:bg-secondary/30">
                      <td className="px-3 py-2 font-bold tabular-nums">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </td>
                      <td className="px-3 py-2 font-medium">{u.ad_soyad}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.yeni_lead}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-success">{u.qazandi}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{u.itirdi}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.cevrilme.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(u.ortalama_deal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{u.ortalama_mudet_gun.toFixed(1)}</td>
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
