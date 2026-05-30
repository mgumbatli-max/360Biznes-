import type { Metadata } from "next";
import { PackageSearch, TrendingUp, Hash } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { ProblemMehsullarTable } from "@/features/servis/components/problemli-mehsullar-table";
import {
  getProblemMehsullar,
  getProblemMehsulSummary,
  getMarkaOptionsForServis,
  getKateqoriyaOptionsForServis,
  type ProblemMehsulFilter,
} from "@/features/servis/queries";

export const metadata: Metadata = { title: "Problemli məhsullar — Servis" };

type SP = Record<string, string | string[] | undefined>;

function pickStr(sp: SP, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}
function pickInt(sp: SP, key: string): number | undefined {
  const v = pickStr(sp, key);
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}
function parseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

export default async function ProblemliMehsullarPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};

  const filter: ProblemMehsulFilter = {};
  const markaId = pickInt(sp, "marka");
  const kateqoriyaId = pickInt(sp, "kateqoriya");
  const from = parseDate(pickStr(sp, "from"));
  const to = parseDate(pickStr(sp, "to"));
  if (markaId != null) filter.marka_id = markaId;
  if (kateqoriyaId != null) filter.kateqoriya_id = kateqoriyaId;
  if (from) filter.from = from;
  if (to) filter.to = to;

  const [rows, summary, markalar, kateqoriyalar] = await Promise.all([
    getProblemMehsullar(filter),
    getProblemMehsulSummary(),
    getMarkaOptionsForServis(),
    getKateqoriyaOptionsForServis(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <BackButton fallback="/servis" label="Servis" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Problemli məhsullar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Servis qeydlərinin məhsul-əsaslı qruplaması. Hansı məhsul ən çox problem yaradır?
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard
          icon={Hash}
          label="Cəmi servis (məhsulla bağlı)"
          value={String(summary.total)}
          subline="Bütün dövr"
        />
        <KpiCard
          icon={PackageSearch}
          label="Unikal məhsul"
          value={String(summary.uniq)}
          subline="Fərqli məhsul adı"
        />
        <KpiCard
          icon={TrendingUp}
          label="Ən çox problemli"
          value={summary.top ? String(summary.top.say) : "—"}
          subline={summary.top?.mehsul_ad ?? "Hələ data yoxdur"}
          tone="warning"
        />
      </section>

      <ProblemMehsullarTable
        rows={rows}
        markalar={markalar.map((m) => ({ id: m.id, ad: m.ad }))}
        kateqoriyalar={kateqoriyalar.map((k) => ({ id: k.id, ad: k.ad }))}
        initial={{
          marka: markaId != null ? String(markaId) : "",
          kateqoriya: kateqoriyaId != null ? String(kateqoriyaId) : "",
          from: pickStr(sp, "from") ?? "",
          to: pickStr(sp, "to") ?? "",
        }}
      />
    </div>
  );
}
