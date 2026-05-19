import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, Sparkles, FlaskConical, Power } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LabActivateButton } from "@/features/lab/components/lab-activate-button";
import { getFeatureById, RENG_BG, RENG_GRADIENT } from "@/features/lab/catalog";
import { isFeatureActive } from "@/features/lab/state";
import { SandboxGeneric } from "@/features/lab/sandboxes/sandbox-generic";
import { SandboxCurrencyFx } from "@/features/lab/sandboxes/sandbox-currency-fx";
import { SandboxRoiCalc } from "@/features/lab/sandboxes/sandbox-roi-calc";
import { SandboxNps } from "@/features/lab/sandboxes/sandbox-nps";
import { SandboxEoq } from "@/features/lab/sandboxes/sandbox-eoq";
import { SandboxAbcPareto } from "@/features/lab/sandboxes/sandbox-abc-pareto";
import { SandboxKpiHeatmap } from "@/features/lab/sandboxes/sandbox-kpi-heatmap";
import { SandboxAbTest } from "@/features/lab/sandboxes/sandbox-ab-test";
import { SandboxCohort } from "@/features/lab/sandboxes/sandbox-cohort";
import { SandboxTrendForecast } from "@/features/lab/sandboxes/sandbox-trend-forecast";
import { SandboxOcr } from "@/features/lab/sandboxes/sandbox-ocr";
import { SandboxExecutive } from "@/features/lab/sandboxes/sandbox-executive";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const f = getFeatureById(id);
  return { title: f ? `${f.ad} — 360 LAB` : "360 LAB" };
}

function SandboxFor({ feature, active }: { feature: ReturnType<typeof getFeatureById>; active: boolean }) {
  if (!feature) return null;
  // Show interactive demo only when active OR when it's a tam-funksional + sandbox-spec defined
  if (!active && feature.status !== "tam") return <SandboxGeneric feature={feature} />;

  switch (feature.sandbox) {
    case "currency_fx": return <SandboxCurrencyFx />;
    case "roi_calc": return <SandboxRoiCalc />;
    case "nps_survey": return <SandboxNps />;
    case "eoq": return <SandboxEoq />;
    case "abc_pareto": return <SandboxAbcPareto />;
    case "kpi_heatmap": return <SandboxKpiHeatmap />;
    case "ab_test": return <SandboxAbTest />;
    case "cohort": return <SandboxCohort />;
    case "trend_forecast": return <SandboxTrendForecast />;
    case "ocr_receipt": return <SandboxOcr />;
    case "executive_summary": return <SandboxExecutive />;
    case "generic":
    default:
      return <SandboxGeneric feature={feature} />;
  }
}

export default async function LabDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feature = getFeatureById(id);
  if (!feature) notFound();

  const active = await isFeatureActive(id);
  const Icon = feature.icon;

  const statusBadge =
    feature.status === "tam"
      ? { label: "Tam funksional", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40" }
      : feature.status === "alfa"
      ? { label: "Alfa", cls: "bg-purple-500/15 text-purple-500 border-purple-500/40" }
      : feature.status === "aktiv"
      ? { label: "Aktiv", cls: "bg-primary/15 text-primary border-primary/40" }
      : { label: "Preview", cls: "bg-amber-500/15 text-amber-500 border-amber-500/40" };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Back link */}
      <Link
        href="/360-lab"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Bütün LAB funksiyaları
      </Link>

      {/* Header */}
      <Card className={`glass relative overflow-hidden ${active ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : ""}`}>
        <div className={`pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-to-br opacity-10 blur-3xl ${RENG_GRADIENT[feature.reng]}`} />
        <CardContent className="relative flex flex-wrap items-start gap-4 py-5">
          <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${RENG_BG[feature.reng]}`}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{feature.ad}</h1>
              <Badge variant="outline" className={`text-[10px] ${statusBadge.cls}`}>{statusBadge.label}</Badge>
              {active && (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-500">
                  <Power className="mr-1 h-2.5 w-2.5" />
                  Sənin LAB-da aktiv
                </Badge>
              )}
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">{feature.tesvir}</p>
          </div>
          <div className="shrink-0">
            <LabActivateButton id={feature.id} active={active} size="md" />
          </div>
        </CardContent>
      </Card>

      {/* Safety + activate hint */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              İzolyasiya təminatı
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Bu funksiya yalnız 360 LAB içində işləyir. Aktivləşdirsən belə, Anbar / Ticarət / Maliyyə kimi modullara
              heç bir təsir etmir. İstədiyin vaxt söndür.
            </p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FlaskConical className="h-4 w-4 text-purple-500" />
              Necə test edim?
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Yuxarıda <strong>Aktivləşdir</strong> düyməsinə bas → bu səhifədə canlı sandbox açılacaq. Bütün test data
              mockup-dur, real verilənlərə təsir etmir.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sandbox area */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">Sandbox</h2>
          {!active && feature.status !== "tam" && (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-500">
              Aktivləşdir → interaktiv demo açılsın
            </Badge>
          )}
        </div>
        <SandboxFor feature={feature} active={active} />
      </div>
    </div>
  );
}
