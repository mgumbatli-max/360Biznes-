import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
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
        <BackButton fallback="/iscilier" className="mt-1" />
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
