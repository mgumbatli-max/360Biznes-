import type { Metadata } from "next";
import { BackButton } from "@/components/ui/back-button";
import { MaasTable } from "@/features/iscilier/components/maas-table";
import { MaasExportButton } from "@/features/iscilier/components/maas-export-button";
import { getMaasTable } from "@/features/iscilier/maas-queries";

export const metadata: Metadata = { title: "Maaş bordrosu" };

const MONTH_LABELS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

export default async function MaasPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const sp = (await searchParams) ?? {};
  const data = await getMaasTable(sp.month);
  const monthLabel = `${MONTH_LABELS[data.month.ay - 1]} ${data.month.il}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/iscilier" className="mt-1" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Maaş bordrosu</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {monthLabel} — hər işçi üçün baz maaş + bonuslar (KPI/komissiya) − cərimə − vergi = <span className="font-semibold brand-text">NET</span>
            </p>
          </div>
        </div>
        <MaasExportButton month={sp.month} />
      </header>

      <MaasTable month={data.month} rows={data.rows} totals={data.totals} />
    </div>
  );
}
