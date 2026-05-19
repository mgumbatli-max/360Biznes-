import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MaasTable } from "@/features/iscilier/components/maas-table";
import { getMaasTable } from "@/features/iscilier/maas-queries";

export const metadata: Metadata = { title: "Maaş bordrosu" };
export const dynamic = "force-dynamic";

const MONTH_LABELS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

export default async function MaasPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const sp = (await searchParams) ?? {};
  const data = await getMaasTable(sp.month);
  const monthLabel = `${MONTH_LABELS[data.month.ay - 1]} ${data.month.il}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/iscilier" className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Maaş bordrosu</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {monthLabel} — hər işçi üçün baz maaş + bonuslar (KPI/komissiya) − cərimə − vergi = <span className="font-semibold brand-text">NET</span>
            </p>
          </div>
        </div>
      </header>

      <MaasTable month={data.month} rows={data.rows} totals={data.totals} />
    </div>
  );
}
