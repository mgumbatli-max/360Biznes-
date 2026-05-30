import type { Metadata } from "next";
import { Users, TrendingDown, Cake, Sparkles } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { AnalitikaPanel } from "@/features/iscilier/components/analitika-panel";
import { getAnalitika } from "@/features/iscilier/analitika-queries";
import { getEmployeeStats } from "@/features/iscilier/queries";
import { generateInsight } from "@/features/iscilier/analitika-insight";

export const metadata: Metadata = { title: "HR Analitika" };

export default async function AnalitikaPage() {
  const [data, stats] = await Promise.all([getAnalitika(), getEmployeeStats()]);
  const insight = await generateInsight(data, stats);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/iscilier" className="mt-1" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HR Analitika</h1>
          <p className="mt-1 text-sm text-muted-foreground">İşçi heyəti, turnover, maaş paylanması və daha çoxu.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Users} label="Aktiv işçi" value={String(stats.aktiv)} subline={`${stats.total} cəmi`} />
        <KpiCard icon={TrendingDown} label="Turnover (12 ay)" value={`${data.turnover_pct}%`} subline="Sənaye orta: 12-15%" tone={data.turnover_pct > 15 ? "danger" : data.turnover_pct > 10 ? "warning" : "success"} />
        <KpiCard icon={Cake} label="Bu ay doğum günü" value={String(data.birthdays_this_month.length)} subline="İşçilər" tone="info" />
        <KpiCard icon={Sparkles} label="Vəzifə sayı" value={String(data.by_vezife.length)} subline="Fərqli vəzifələr" />
      </section>

      <AnalitikaPanel data={data} insight={insight} />
    </div>
  );
}
