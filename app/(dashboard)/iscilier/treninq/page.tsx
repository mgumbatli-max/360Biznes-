import type { Metadata } from "next";
import { GraduationCap, BookOpen, CheckCircle2, Wallet } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { TreninqPanel } from "@/features/iscilier/components/treninq-panel";
import { listTreninqler, listTreninqQeydleri, getTreninqStats } from "@/features/iscilier/treninq-queries";
import { getEmployees } from "@/features/iscilier/queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Treninq" };

export default async function TreninqPage() {
  const [treninqler, qeydler, stats, employees] = await Promise.all([
    listTreninqler(),
    listTreninqQeydleri(),
    getTreninqStats(),
    getEmployees({ aktiv: true }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/iscilier" className="mt-1" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Treninq</h1>
          <p className="mt-1 text-sm text-muted-foreground">Treninq kursları və işçi inkişafı.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={BookOpen} label="Kurs sayı" value={String(stats.kurs_sayi)} subline="Açıq treninq" />
        <KpiCard icon={GraduationCap} label="Təyin olunan" value={String(stats.teyin_olunan)} subline="Cəmi qeyd" tone="info" />
        <KpiCard icon={CheckCircle2} label="Mecburi %" value={`${stats.mecburi_complete_pct}%`} subline="Tamamlanma" tone={stats.mecburi_complete_pct > 70 ? "success" : "warning"} />
        <KpiCard icon={Wallet} label="Treninq xərci" value={formatMoney(stats.total_xerc)} subline="Tamam edilmiş" />
      </section>

      <TreninqPanel
        treninqler={treninqler}
        qeydler={qeydler}
        employees={employees.map((e) => ({ id: e.id, ad_soyad: e.ad_soyad }))}
      />
    </div>
  );
}
