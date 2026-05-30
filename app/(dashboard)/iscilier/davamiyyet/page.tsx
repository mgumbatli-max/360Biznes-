import type { Metadata } from "next";
import { BackButton } from "@/components/ui/back-button";
import { DavamiyyetPanel } from "@/features/iscilier/components/davamiyyet-panel";
import { getDavamiyyetData } from "@/features/iscilier/davamiyyet-queries";

export const metadata: Metadata = { title: "Davamiyyət" };

export default async function DavamiyyetPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string; istifadeci_id?: string; status?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const data = await getDavamiyyetData({
    month: sp.month,
    istifadeci_id: sp.istifadeci_id,
    status: sp.status,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/iscilier" className="mt-1" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Davamiyyət</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gəliş-gediş izi və günlük davamiyyət qeydi.</p>
          </div>
        </div>
      </header>

      <DavamiyyetPanel
        month={data.month}
        rows={data.rows}
        employees={data.employees}
        grid={data.grid}
        kpi={data.kpi}
        report={data.report}
        currentFilters={{ istifadeci_id: sp.istifadeci_id, status: sp.status }}
      />
    </div>
  );
}
