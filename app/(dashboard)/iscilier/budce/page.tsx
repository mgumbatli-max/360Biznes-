import type { Metadata } from "next";
import { Users, Wallet, TrendingUp } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { BudcePanel } from "@/features/iscilier/components/budce-panel";
import { getBudce } from "@/features/iscilier/budce-queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Büdcə və headcount" };

export default async function BudcePage() {
  const { requireHrPagePerm } = await import("@/features/iscilier/access-guard");
  await requireHrPagePerm("hr.budce");

  const data = await getBudce();
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/iscilier" className="mt-1" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Büdcə və headcount</h1>
          <p className="mt-1 text-sm text-muted-foreground">Şöbə üzrə cari işçi heyəti, büdcə və planlama.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard icon={Users} label="Cəmi işçi" value={String(data.total_headcount)} subline="Aktiv heyət" />
        <KpiCard icon={Wallet} label="Aylıq büdcə" value={formatMoney(data.total_budget)} subline="Cari maaş cəmi" />
        <KpiCard icon={TrendingUp} label="Planlanan" value={String(data.total_planned)} subline="Yeni + əvəzləmə" tone="info" />
      </section>

      <BudcePanel sobeler={data.sobeler} />
    </div>
  );
}
