import type { Metadata } from "next";
import { Users, MessageSquare, TrendingUp, Wallet, ClipboardList, CalendarClock, BarChart3, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmSubNav } from "@/components/crm-subnav";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { formatMoney } from "@/lib/utils";
import { getDashboardKpis, getLeadSourceBreakdown, getDailyLeadsLast30, getLeadFunnel, getRecentActivity, getLeadSourceAnalytics } from "@/features/crm/dashboard-queries";
import { DailyChart, SourcesChart, FunnelChart, SourceAnalyticsChart } from "@/features/crm/components/dashboard-charts";
import { CrmRecentActivity } from "@/features/crm/components/recent-activity";

export const metadata: Metadata = { title: "CRM / Dashboard" };
export const dynamic = "force-dynamic";

export default async function CrmHubPage() {
  const [kpis, sources, daily, funnel, activity, sourceAnalytics] = await Promise.all([
    getDashboardKpis(),
    getLeadSourceBreakdown(),
    getDailyLeadsLast30(),
    getLeadFunnel(),
    getRecentActivity(20),
    getLeadSourceAnalytics(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <CrmSubNav active="/crm" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">CRM Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lead pipeline, müştəri kommunikasiya və satış konversiyası.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={Users} label="Aktiv leadlər" value={String(kpis.active_leads)} subline="Pipeline-da" />
        <KpiCard icon={TrendingUp} label="Bu ay yeni" value={String(kpis.this_month_leads)} subline="Yaradılıb" tone="info" />
        <KpiCard icon={BarChart3} label="Çevrilmə" value={`${kpis.conversion.toFixed(1)}%`} subline={`${kpis.won_leads} qazanılıb`} tone="success" />
        <KpiCard icon={Wallet} label="Ortalama deal" value={formatMoney(kpis.avg_deal)} subline="Qazanılan dəyər" />
        <KpiCard icon={ClipboardList} label="Açıq tapşırıq" value={String(kpis.open_tasks)} subline="Aktiv" tone={kpis.open_tasks > 0 ? "warning" : "neutral"} />
        <KpiCard icon={CalendarClock} label="Follow-up (7g)" value={String(kpis.followup_this_week)} subline="Bu həftə" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Son 30 gün yeni leadlər</CardTitle>
            <p className="text-xs text-muted-foreground">Gündəlik yaradılma sayı</p>
          </CardHeader>
          <CardContent>
            <DailyChart data={daily} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mənbə bölgüsü</CardTitle>
            <p className="text-xs text-muted-foreground">Top mənbə</p>
          </CardHeader>
          <CardContent>
            <SourcesChart data={sources} />
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Funnel</CardTitle>
            <p className="text-xs text-muted-foreground">Mərhələ üzrə lead sayı</p>
          </CardHeader>
          <CardContent>
            <FunnelChart data={funnel} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> Son aktivlik</CardTitle>
          </CardHeader>
          <CardContent>
            <CrmRecentActivity items={activity} />
          </CardContent>
        </Card>
      </section>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-1.5"><Megaphone className="h-4 w-4" /> Lead qaynaqları — ROI & Dönüşüm</CardTitle>
          <p className="text-xs text-muted-foreground">Hər qaynaq üçün cəmi lead, qazanılan, dönüşüm % və gəlir</p>
        </CardHeader>
        <CardContent>
          <SourceAnalyticsChart data={sourceAnalytics} />
        </CardContent>
      </Card>
    </div>
  );
}
