import type { Metadata } from "next";
import { ShieldCheck, Clock, Plus, Calendar } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { ZemanetTable } from "@/features/servis/components/zemanet-table";
import { ZemanetDialog } from "@/features/servis/components/zemanet-dialog";
import { getZemanetler, getZemanetStats } from "@/features/servis/queries";

export const metadata: Metadata = { title: "Zəmanətlər" };

export default async function ZemanetPage() {
  const [rows, stats] = await Promise.all([getZemanetler(), getZemanetStats()]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/servis" className="mt-1" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Zəmanətlər</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Talon idarəetməsi, satışlar üzrə avtomatik yaranan zəmanətlər və manual giriş.
            </p>
          </div>
        </div>
        <ZemanetDialog />
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={ShieldCheck} label="Aktiv zəmanət" value={String(stats.active)} subline="Hələ qüvvədə" tone="success" />
        <KpiCard icon={Clock} label="Bitməyə yaxın" value={String(stats.expiringSoon)} subline="30 gün qalıb" tone="warning" />
        <KpiCard icon={Plus} label="Bu ay yaradılan" value={String(stats.createdThisMonth)} subline="Yeni talonlar" />
        <KpiCard icon={Calendar} label="Bu ay bitənlər" value={String(stats.endingThisMonth)} subline="Sona çatır" />
      </section>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <ShieldCheck className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Zəmanət yoxdur</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Satış zamanı zəmanət avtomatik yaradılır (məhsul üçün zəmanət şablonu varsa) və ya manual əlavə edin.
          </p>
        </div>
      ) : (
        <ZemanetTable rows={rows} />
      )}
    </div>
  );
}
