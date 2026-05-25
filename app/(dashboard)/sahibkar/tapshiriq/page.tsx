import type { Metadata } from "next";
import { ClipboardList, Lock, Flag, AlertCircle, CheckCircle2, Circle, PauseCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerTasks, getStaffOptions } from "@/features/sahibkar/owner-queries";
import { TaskDialog, TaskStatusSelect } from "@/features/sahibkar/components/task-dialog";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { EntityLinkBadge, type EntityLinkNov } from "@/features/sahibkar/components/entity-link-input";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Sahibkar tapşırıqları" };
export const dynamic = "force-dynamic";

type ColumnSpec = {
  key: string;
  label: string;
  textTone: string;
  ringTone: string;
  headerBg: string;
  icon: typeof Circle;
  emoji: string;
};

const COLUMNS: ColumnSpec[] = [
  { key: "acig",     label: "Açıq",       textTone: "text-slate-600 dark:text-slate-300", ringTone: "border-slate-400/40",   headerBg: "from-slate-500/15 to-slate-500/0",   icon: Circle,         emoji: "📋" },
  { key: "isleyir",  label: "İşləyir",    textTone: "text-sky-600 dark:text-sky-400",      ringTone: "border-sky-500/40",     headerBg: "from-sky-500/15 to-sky-500/0",       icon: PauseCircle,    emoji: "⚙️" },
  { key: "yoxlama",  label: "Yoxlama",    textTone: "text-amber-600 dark:text-amber-400",  ringTone: "border-amber-500/40",   headerBg: "from-amber-500/15 to-amber-500/0",   icon: AlertCircle,    emoji: "🔍" },
  { key: "tamam",    label: "Tamamlandı", textTone: "text-emerald-600 dark:text-emerald-400", ringTone: "border-emerald-500/40", headerBg: "from-emerald-500/15 to-emerald-500/0", icon: CheckCircle2, emoji: "✅" },
];

const PRIORITY_TONE: Record<string, { class: string; emoji: string }> = {
  yuksek:  { class: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",    emoji: "🔥" },
  orta:    { class: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400", emoji: "⚡" },
  asagi:   { class: "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300", emoji: "🌱" },
};

export default async function SahibkarTapshiriqPage() {
  await requireSahibkarSession();
  const [tasks, staff] = await Promise.all([getOwnerTasks(100), getStaffOptions()]);

  const now = Date.now();
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sahibkar tapşırıqları</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kanban: prioritetə görə rəngli kartlar, statusu seçməklə sütunlar arası daşı.</p>
        </div>
        <TaskDialog staff={staff} />
      </header>

      <SectionExplainer
        icon={ClipboardList}
        title="Bu Kanban nəyə yarayır?"
        tone="sky"
        description="Şəxsi tapşırıq lövhəsi — yalnız sahibkar görür. Prioritetə görə rəngli kartlar, deadline yaxınlaşdıqda xəbərdarlıq, status seçərək sürətli irəliləmə."
        bullets={[
          { label: "🔥 Yüksək", text: "təcili işlər (qırmızı tonu)" },
          { label: "⚡ Orta", text: "standard prioritet" },
          { label: "🌱 Aşağı", text: "imkan olanda" },
          { label: "Yaxınlaş", text: "deadline 24 saat ərzindədirsə xəbərdarlıq görünür" },
        ]}
      />

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Tapşırıq yoxdur</h3>
          <p className="mt-1 text-xs text-muted-foreground">Yuxarıdan &quot;Yeni tapşırıq&quot; ilə əlavə edin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = tasks.filter((t) => (t.status ?? "acig") === col.key);
            const ColIcon = col.icon;
            return (
              <div key={col.key} className={`space-y-2 rounded-xl border ${col.ringTone} bg-card/30 p-2`}>
                <div className={`flex items-center justify-between rounded-md bg-gradient-to-r ${col.headerBg} px-2 py-1`}>
                  <h3 className={`flex items-center gap-1.5 text-sm font-semibold ${col.textTone}`}>
                    <ColIcon className="h-3.5 w-3.5" /> {col.emoji} {col.label}
                  </h3>
                  <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map((t) => {
                    const prio = PRIORITY_TONE[(t.prioritet ?? "orta").toLowerCase()] ?? PRIORITY_TONE.orta;
                    const due = t.tarix ? new Date(t.tarix).getTime() : null;
                    const isOverdue = due !== null && due < now && col.key !== "tamam";
                    const isDueSoon = due !== null && due >= now && due - now < 24 * 3600 * 1000 && col.key !== "tamam";
                    return (
                      <Card key={t.id} className={`glass border-l-4 ${prio.class.split(" ").find((c) => c.startsWith("border-")) ?? "border-l-slate-400"} transition hover:shadow-md`}>
                        <CardContent className="space-y-1.5 py-3">
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="text-sm font-medium leading-tight">{t.basliq}</div>
                            <TaskDialog task={{ id: t.id, basliq: t.basliq, tesvir: t.tesvir, tarix: t.tarix, prioritet: t.prioritet, status: t.status, link_nov: t.link_nov, link_id: t.link_id, link_label: t.link_label }} staff={staff} />
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className={`text-[10px] ${prio.class}`}>
                              <Flag className="h-2.5 w-2.5" /> {prio.emoji} {t.prioritet ?? "orta"}
                            </Badge>
                            <Badge variant="outline" className="border-primary/30 text-[10px] text-primary-light">
                              <Lock className="h-2.5 w-2.5" /> Sahibkar
                            </Badge>
                            {isOverdue && (
                              <Badge variant="outline" className="border-rose-500/40 bg-rose-500/15 text-[10px] text-rose-600 dark:text-rose-400">
                                ⏰ Gecikib
                              </Badge>
                            )}
                            {isDueSoon && (
                              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400">
                                ⏳ Bugün
                              </Badge>
                            )}
                          </div>
                          {t.tesvir ? <p className="line-clamp-2 text-xs text-muted-foreground">{t.tesvir}</p> : null}
                          {t.link_nov && t.link_id && (
                            <div className="pt-0.5">
                              <EntityLinkBadge nov={t.link_nov as EntityLinkNov} id={t.link_id} label={t.link_label} withHref size="xs" />
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                            <span className="truncate">{t.mesul_ad ?? "—"}</span>
                            <span>{t.tarix ? formatDate(t.tarix, { day: "2-digit", month: "short" }) : "—"}</span>
                          </div>
                          <div className="pt-1">
                            <TaskStatusSelect id={t.id} status={t.status} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed border-border/40 p-3 text-center text-[10.5px] text-muted-foreground/70">
                      Boş sütun
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
