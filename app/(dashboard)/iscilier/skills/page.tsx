import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { SkillsMatrixView } from "@/features/iscilier/components/skills-matrix";
import { getSkillsMatrix, getOrgChart } from "@/features/iscilier/hr-queries";

export const metadata: Metadata = { title: "Bacarıqlar matriksi" };
export const dynamic = "force-dynamic";

export default async function SkillsPage({
  searchParams,
}: {
  searchParams?: Promise<{ sobe?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [data, org] = await Promise.all([getSkillsMatrix(sp.sobe), getOrgChart()]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <Link
          href="/iscilier"
          className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-5 w-5" /> Bacarıqlar matriksi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Komandanın bacarıq xəritəsi (1–5 səviyyə). Bacarıq boşluqlarını avtomatik müəyyən edir.
          </p>
        </div>
      </header>

      <SkillsMatrixView data={data} sobeler={org.sobeler} activeSobe={sp.sobe} />
    </div>
  );
}
