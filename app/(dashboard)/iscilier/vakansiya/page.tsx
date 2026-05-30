import type { Metadata } from "next";
import { Briefcase, Users, CheckCircle2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { VakansiyaPanel } from "@/features/iscilier/components/vakansiya-panel";
import { listVakansiya, listNamizedler, getVakansiyaStats } from "@/features/iscilier/vakansiya-queries";

export const metadata: Metadata = { title: "Vakansiya" };

export default async function VakansiyaPage() {
  const [vaks, nams, stats] = await Promise.all([
    listVakansiya(),
    listNamizedler(),
    getVakansiyaStats(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/iscilier" className="mt-1" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vakansiya</h1>
          <p className="mt-1 text-sm text-muted-foreground">Açıq vakansiyalar və namizədlər.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Briefcase} label="Açıq vakansiya" value={String(stats.acig)} subline={`${stats.total} cəmi`} />
        <KpiCard icon={Users} label="Namizədlər" value={String(stats.namized_count)} subline="Cəmi" tone="info" />
        <KpiCard icon={CheckCircle2} label="Qəbul" value={String(stats.qebul)} subline="İşə götürülmüş" tone="success" />
        <KpiCard icon={Briefcase} label="Bağlanmış" value={String(stats.total - stats.acig)} subline="Bağlandı + dayandırıldı" />
      </section>

      <VakansiyaPanel vaks={vaks} nams={nams} />
    </div>
  );
}
