import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";
import { OrgChartView } from "@/features/iscilier/components/org-chart";
import { getOrgChart } from "@/features/iscilier/hr-queries";

export const metadata: Metadata = { title: "Org chart — Heyət strukturu" };
export const dynamic = "force-dynamic";

export default async function OrgChartPage({
  searchParams,
}: {
  searchParams?: Promise<{ sobe?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const data = await getOrgChart(sp.sobe);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3 print:hidden">
        <Link
          href="/iscilier"
          className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Network className="h-5 w-5" /> Org chart
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Heyət strukturu — CEO → Direktorlar → Menecerlər → Əməkdaşlar
          </p>
        </div>
      </header>

      <OrgChartView
        ceo={data.ceo}
        directors={data.directors}
        managers={data.managers}
        staff={data.staff}
        sobeler={data.sobeler}
        activeSobe={sp.sobe}
      />
    </div>
  );
}
