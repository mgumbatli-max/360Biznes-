import type { Metadata } from "next";
import { Plane, CalendarDays, ListChecks } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { MezuniyyetPanel } from "@/features/iscilier/components/mezuniyyet-panel";
import { getLeaveRequests, getLeaveStats, getLeaveBalances, getEmployees } from "@/features/iscilier/queries";

export const metadata: Metadata = { title: "Məzuniyyət" };
export const dynamic = "force-dynamic";

export default async function MezuniyyetPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; month?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [rows, stats, balances, employees] = await Promise.all([
    getLeaveRequests({ status: sp.status, month: sp.month }),
    getLeaveStats(),
    getLeaveBalances(),
    getEmployees({ aktiv: true }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/iscilier" className="mt-1" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Məzuniyyət</h1>
            <p className="mt-1 text-sm text-muted-foreground">Məzuniyyət ərizələri və təsdiq idarəsi.</p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard icon={Plane} label="Bu ay ərizə" value={String(stats.bu_ay_say)} subline="Bu ay başlayan" />
        <KpiCard icon={CalendarDays} label="Bu ay cəmi gün" value={String(stats.bu_ay_gun)} subline="Məzuniyyət günləri" />
        <KpiCard icon={ListChecks} label="Gözləyən ərizələr" value={String(stats.gozleyir)} subline="Təsdiq tələb edir" tone={stats.gozleyir > 0 ? "warning" : "neutral"} />
      </section>

      <MezuniyyetPanel
        rows={rows}
        employees={employees.map((e) => ({ id: e.id, ad_soyad: e.ad_soyad }))}
        balances={balances}
        filters={{ status: sp.status, month: sp.month }}
      />
    </div>
  );
}
