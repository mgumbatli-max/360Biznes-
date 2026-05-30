import type { Metadata } from "next";
import { FileText, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskSectionTabs } from "@/features/tapshiriqlar/components/section-tabs";
import { TASK_TEMPLATES, type TaskTemplate } from "@/features/tapshiriqlar/templates";
import { TemplateCardButton } from "@/features/tapshiriqlar/components/template-card-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tapşırıqlar — Şablonlar" };

const CATEGORY_LABEL: Record<TaskTemplate["category"], { label: string; cls: string }> = {
  daily:      { label: "Gündəlik",  cls: "border-amber-500/30 bg-amber-500/10 text-amber-500" },
  weekly:     { label: "Həftəlik",  cls: "border-violet-500/30 bg-violet-500/10 text-violet-500" },
  monthly:    { label: "Aylıq",     cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" },
  onboarding: { label: "Onboarding", cls: "border-sky-500/30 bg-sky-500/10 text-sky-500" },
  ad_hoc:     { label: "Ad-hoc",    cls: "border-slate-500/30 bg-slate-500/10 text-slate-500" },
};

const PRIORITY_LABEL: Record<string, string> = {
  asagi: "Aşağı", normal: "Normal", yuksek: "Yüksək", tecili: "Təcili",
};

export default function TaskTemplatesPage() {
  // Group by category
  const groups = new Map<TaskTemplate["category"], TaskTemplate[]>();
  for (const t of TASK_TEMPLATES) {
    if (!groups.has(t.category)) groups.set(t.category, []);
    groups.get(t.category)!.push(t);
  }
  const ordered: TaskTemplate["category"][] = ["daily", "weekly", "monthly", "onboarding", "ad_hoc"];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary to-violet-500">
          <FileText className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tapşırıq şablonları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tez-tez təkrarlanan tapşırıqları bir kliklə yarat — checklist daxil.
          </p>
        </div>
      </header>

      <TaskSectionTabs current="sablonlar" />

      {ordered.map((cat) => {
        const items = groups.get(cat);
        if (!items || items.length === 0) return null;
        const meta = CATEGORY_LABEL[cat];
        return (
          <section key={cat} className="space-y-2">
            <header className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>{meta.label}</Badge>
              <span className="text-xs text-muted-foreground">{items.length} şablon</span>
            </header>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => {
                const Icon = t.icon;
                return (
                  <Card key={t.id} className="glass relative overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/40">
                    <div className={cn("pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-15 blur-2xl", t.color)} />
                    <CardContent className="relative space-y-3 py-4">
                      <div className="flex items-start gap-2.5">
                        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-md", t.color)}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold leading-tight">{t.ad}</h3>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.tesvir}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className="text-[9px]">
                          {PRIORITY_LABEL[t.prioritet]}
                        </Badge>
                        {t.defaults.deadline_offset_hours != null && (
                          <Badge variant="outline" className="text-[9px]">
                            <Clock className="mr-0.5 h-2 w-2" />
                            {t.defaults.deadline_offset_hours < 24
                              ? `${t.defaults.deadline_offset_hours}s`
                              : `${Math.floor(t.defaults.deadline_offset_hours / 24)}g`}
                          </Badge>
                        )}
                        {t.checklist && t.checklist.length > 0 && (
                          <Badge variant="outline" className="text-[9px]">
                            ✓ {t.checklist.length} checklist
                          </Badge>
                        )}
                      </div>

                      {t.checklist && t.checklist.length > 0 && (
                        <details className="text-[11px] text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">Checklist göstər</summary>
                          <ul className="mt-1.5 space-y-0.5 pl-3 list-disc">
                            {t.checklist.map((c, i) => <li key={i}>{c}</li>)}
                          </ul>
                        </details>
                      )}

                      <div className="flex items-center justify-end border-t border-border/30 pt-2">
                        <TemplateCardButton templateId={t.id} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
