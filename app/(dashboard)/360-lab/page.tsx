import type { Metadata } from "next";
import { FlaskConical, Sparkles, ShieldCheck, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LabCard } from "@/features/lab/components/lab-card";
import { LabTabs, type ActiveTab } from "@/features/lab/components/lab-tabs";
import { LAB_FEATURES, LAB_CATEGORIES, type LabFeature } from "@/features/lab/catalog";
import { getActiveFeatures } from "@/features/lab/state";

export const metadata: Metadata = { title: "360 LAB — Eksperimental zona" };
export const dynamic = "force-dynamic";

type SP = { tab?: string };

function filterFeatures(tab: ActiveTab, active: string[]): LabFeature[] {
  if (tab === "hamisi") return LAB_FEATURES;
  if (tab === "aktiv") return LAB_FEATURES.filter((f) => active.includes(f.id));
  if (tab === "preview") return LAB_FEATURES.filter((f) => f.status === "preview");
  return LAB_FEATURES.filter((f) => f.kateqoriyalar.includes(tab));
}

function computeCounts(active: string[]): Record<string, number> {
  const counts: Record<string, number> = {
    hamisi: LAB_FEATURES.length,
    aktiv: active.length,
    preview: LAB_FEATURES.filter((f) => f.status === "preview").length,
  };
  for (const cat of ["exkluziv", "12hedef", "ekstra10", "pre1k", "enterprise60", "tamfunksional"] as const) {
    counts[cat] = LAB_FEATURES.filter((f) => f.kateqoriyalar.includes(cat)).length;
  }
  return counts;
}

export default async function LabHomePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = (sp.tab ?? "hamisi") as ActiveTab;
  const validTab = LAB_CATEGORIES.some((c) => c.id === tab) ? tab : "hamisi";

  const active = await getActiveFeatures();
  const counts = computeCounts(active);
  const filtered = filterFeatures(validTab, active);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Hero header */}
      <header className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-purple-500/5 via-card to-card p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 opacity-10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 opacity-10 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
              <FlaskConical className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">360 LAB — Eksperimental zona</h1>
                <Badge variant="outline" className="border-purple-500/40 bg-purple-500/10 text-[9px] text-purple-500">
                  <Sparkles className="mr-1 h-2.5 w-2.5" />
                  BETA
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {LAB_FEATURES.length}+ yeni funksiya yalnız burada sınanır. Aktivləşdirdiyin funksiya yalnız LAB içində
                işləyir — <span className="font-semibold text-foreground">mövcud sistemə təsir etməz</span>. Sevdiyini
                saxla, sevmədiyini söndür.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-3">
            <Stat icon={Activity} label="Aktiv" value={active.length} color="emerald" />
            <Stat icon={Sparkles} label="Preview" value={counts.preview} color="amber" />
            <Stat icon={ShieldCheck} label="Tam funksional" value={counts.tamfunksional} color="primary" />
          </div>
        </div>

        {/* Safety reminder */}
        <div className="relative mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          <p className="text-emerald-700 dark:text-emerald-300">
            <strong>Təhlükəsiz test zonası:</strong> Hər funksiya bölmə daxili sandbox-da işləyir. Real verilənlər
            yalnız oxunur — heç bir başqa modula yazma əməliyyatı baş vermir.
          </p>
        </div>
      </header>

      {/* Filter tabs */}
      <LabTabs current={validTab} counts={counts} />

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Bu kateqoriyada funksiya yoxdur
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <LabCard key={f.id} feature={f} active={active.includes(f.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: "emerald" | "amber" | "primary";
}) {
  const cls =
    color === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
      : color === "amber"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
      : "border-primary/30 bg-primary/10 text-primary";
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${cls}`}>
      <Icon className="h-4 w-4" />
      <div>
        <div className="text-xl font-bold leading-none tabular-nums">{value}</div>
        <div className="text-[9px] uppercase tracking-wider opacity-75">{label}</div>
      </div>
    </div>
  );
}
