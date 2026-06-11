import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, AlertTriangle, CheckCircle2, Info, AlertCircle, ArrowRight, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildAiInsights } from "@/features/hesabatlar/ai-insights";
import { AiGenerateButton } from "@/features/hesabatlar/components/ai-generate-button";
import { ReportChat } from "@/features/hesabatlar/components/report-chat";

export const metadata: Metadata = { title: "AI Insights" };

const ICON_MAP = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

const TONE_MAP: Record<string, string> = {
  info: "border-info/30 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

export default async function AiInsightsPage() {
  const { insights, ai_text, is_mock } = await buildAiInsights();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">AI Insights</h1>
            {is_mock && <Badge variant="outline" className="text-[10px]">Mock-mode</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Biznes göstəricilərə əsaslanan AI tövsiyə və müşahidələr.</p>
        </div>
      </header>

      {/* #14 Faza A — təbii dildə hesabat soruş (real datadan, oxu-only AI agent) */}
      <ReportChat />

      <section className="space-y-3">
        {insights.length === 0 ? (
          <Card className="glass">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Yetərincə məlumat yoxdur</CardContent>
          </Card>
        ) : (
          insights.map((ins, i) => {
            const Icon = ICON_MAP[ins.kind];
            const sev = ins.severity ?? 0;
            return (
              <Card key={i} className={`glass border-l-4 ${TONE_MAP[ins.kind]} transition-all hover:-translate-y-0.5 hover:shadow-md`}>
                <CardContent className="flex items-start gap-3 py-4">
                  <Icon className={`mt-0.5 h-5 w-5 ${TONE_MAP[ins.kind].split(" ").pop()}`} />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{ins.title}</h3>
                      {sev >= 7 && (
                        <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-[9px] text-rose-500">
                          <Flame className="mr-1 h-2.5 w-2.5" /> KRİTİK · {sev}/10
                        </Badge>
                      )}
                      {sev >= 4 && sev < 7 && (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[9px] text-amber-500">
                          ORTA · {sev}/10
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{ins.body}</p>
                    {ins.action_href && (
                      <Link
                        href={ins.action_href}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:gap-2 transition-all"
                      >
                        {ins.action_label ?? "Ətraflı"}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary-light" />
            AI tövsiyə (Claude)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{ai_text}</div>
          {is_mock && (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <strong>Mock-mode:</strong> Real Claude AI cavablar üçün <code>.env</code> faylına <code>ANTHROPIC_API_KEY</code> əlavə edin.
            </p>
          )}
          <div className="border-t border-border/40 pt-4">
            <p className="mb-2 text-xs text-muted-foreground">Hazırkı biznes göstəricilərinə əsasən yeni AI tövsiyə yarat:</p>
            <AiGenerateButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
