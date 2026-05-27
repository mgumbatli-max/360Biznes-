import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight, Workflow, Zap, Filter, Target, Bell, Repeat, FlaskConical,
  CheckCircle2, XCircle, Calendar, Clock, User,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRuleDefinition, getRuleStatsById } from "@/features/avtomatlasdirma/actions";
import { TRIGGERS, MODULLAR, PRIORITY_META, ACTIONS, SCOPES, SCHEDULES, SHERT_META, KANALLAR, RECIPIENTS } from "@/features/avtomatlasdirma/catalog";
import { RuleCard } from "@/features/avtomatlasdirma/components/rule-card";
import { formatDate, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Qayda detalı" };
export const dynamic = "force-dynamic";

type SafeShert = { logic?: "and" | "or"; conditions?: { field: string; operator: string; value: number }[]; scope?: { type: string }[] };
type SafeAction = { actions?: { kod: string }[]; notification?: { recipients?: string[]; channels?: string[]; template?: string } };

function parseShert(json: unknown): SafeShert {
  if (json && typeof json === "object" && !Array.isArray(json)) return json as SafeShert;
  return {};
}
function parseAction(json: unknown): SafeAction {
  if (json && typeof json === "object" && !Array.isArray(json)) return json as SafeAction;
  return {};
}

export default async function RuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) notFound();

  const rule = await getRuleDefinition(idNum);
  if (!rule) notFound();
  const stats = await getRuleStatsById(idNum);

  const trigger = TRIGGERS.find((t) => t.kod === rule.trigger_kod);
  const modulMeta = rule.modul ? MODULLAR[rule.modul as keyof typeof MODULLAR] : null;
  const priorityMeta = PRIORITY_META[(rule.prioritet ?? "orta") as keyof typeof PRIORITY_META];
  const shert = parseShert(rule.shert_json);
  const action = parseAction(rule.action_json);
  const schedule = SCHEDULES[(rule.tekrarlanma ?? "realtime") as keyof typeof SCHEDULES];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/avtomatlasdirma" className="inline-flex items-center gap-1 hover:text-foreground">
          <Workflow className="h-3 w-3" />
          Avtomatlaşdırma
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>#{rule.id}</span>
      </nav>

      {/* Card preview with actions */}
      <RuleCard rule={{
        id: rule.id,
        ad: rule.ad,
        tesvir: rule.tesvir,
        modul: rule.modul,
        trigger_kod: rule.trigger_kod,
        prioritet: rule.prioritet,
        aktiv: rule.aktiv,
        sistem_qayda: rule.sistem_qayda,
        son_islem: rule.son_islem,
        islem_say: rule.islem_say,
        yaradildi: rule.yaradildi,
        tekrarlanma: rule.tekrarlanma,
        action_json: rule.action_json,
        _count: { avto_log: stats.total },
      }} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatPill icon={Zap} label="24 saat icra" value={stats.day} tone="primary" />
        <StatPill icon={Calendar} label="7 günlük icra" value={stats.week} tone="emerald" />
        <StatPill icon={FlaskConical} label="Ümumi icra" value={stats.total} tone="amber" />
        <StatPill icon={XCircle} label="7 günlük xəta" value={stats.errors7} tone={stats.errors7 > 0 ? "rose" : "neutral"} />
      </div>

      {/* Definition */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Trigger */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Hadisə (Trigger)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="font-semibold">{trigger?.ad ?? rule.trigger_kod}</div>
            <div className="text-[11px] text-muted-foreground">{trigger?.tesvir}</div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {modulMeta && <Badge variant="outline" className={cn("text-[10px]", modulMeta.reng)}>{modulMeta.ad}</Badge>}
              <Badge variant="outline" className={cn("text-[10px]", priorityMeta.cls)}>{priorityMeta.ad}</Badge>
              <Badge variant="outline" className="text-[10px]">
                <Repeat className="mr-0.5 h-2.5 w-2.5" />
                {schedule?.ad ?? rule.tekrarlanma}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Conditions */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Filter className="h-3.5 w-3.5 text-sky-500" />
              Şərtlər ({(shert.conditions ?? []).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(shert.conditions ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Şərt yoxdur — qayda hər zaman işə düşür</p>
            ) : (
              <div className="space-y-1.5">
                <Badge variant="outline" className="text-[9px]">{(shert.logic ?? "and").toUpperCase()} məntiqi</Badge>
                {(shert.conditions ?? []).map((c, i) => {
                  const meta = SHERT_META[c.field as keyof typeof SHERT_META];
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs">
                      <span className="font-medium">{meta?.label ?? c.field}</span>
                      <code className="rounded bg-card px-1 font-mono text-[10px]">{c.operator}</code>
                      <span className="font-bold tabular-nums">{c.value}</span>
                      {meta?.suffix && <span className="text-muted-foreground">{meta.suffix}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scope */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-3.5 w-3.5 text-violet-500" />
              Tətbiq sahəsi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {(shert.scope ?? [{ type: "all" }]).map((s, i) => {
                const meta = SCOPES[s.type as keyof typeof SCOPES];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    <Icon className="mr-0.5 h-2.5 w-2.5" />
                    {meta.ad}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-3.5 w-3.5 text-emerald-500" />
              Əməliyyatlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {(action.actions ?? []).map((a) => {
                const meta = ACTIONS.find((x) => x.kod === a.kod);
                if (!meta) return <Badge key={a.kod} variant="outline" className="text-[10px]">{a.kod}</Badge>;
                const Icon = meta.icon;
                return (
                  <Badge key={a.kod} variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-[10px] text-emerald-500">
                    <Icon className="mr-0.5 h-2.5 w-2.5" />
                    {meta.ad}
                  </Badge>
                );
              })}
            </div>

            {action.notification && (action.notification.recipients?.length || action.notification.channels?.length) && (
              <div className="rounded-md border border-border bg-secondary/30 p-2 space-y-1 text-[11px]">
                {action.notification.recipients?.length ? (
                  <div>
                    <span className="text-muted-foreground">Kimə: </span>
                    {action.notification.recipients.map((r) => RECIPIENTS[r as keyof typeof RECIPIENTS] ?? r).join(", ")}
                  </div>
                ) : null}
                {action.notification.channels?.length ? (
                  <div>
                    <span className="text-muted-foreground">Kanal: </span>
                    {action.notification.channels.map((c) => KANALLAR[c as keyof typeof KANALLAR]?.ad ?? c).join(", ")}
                  </div>
                ) : null}
                {action.notification.template && (
                  <div className="mt-1 rounded bg-card/60 px-2 py-1 italic text-muted-foreground">
                    &ldquo;{action.notification.template}&rdquo;
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit info */}
      <Card className="glass">
        <CardContent className="grid grid-cols-1 gap-3 py-3 text-xs md:grid-cols-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Yaradıldı</div>
            <div className="mt-0.5">
              {rule.yaradildi && <span><Calendar className="mr-1 inline h-3 w-3" />{formatDate(rule.yaradildi, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
            {rule.istifadeciler_avto_qayda_yaradan_idToistifadeciler && (
              <div className="text-[10.5px] text-muted-foreground">
                <User className="mr-1 inline h-2.5 w-2.5" />
                {rule.istifadeciler_avto_qayda_yaradan_idToistifadeciler.ad_soyad}
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Son icra</div>
            <div className="mt-0.5">
              {rule.son_islem ? (
                <span><Clock className="mr-1 inline h-3 w-3" />{formatDate(rule.son_islem, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              ) : (
                <span className="text-muted-foreground">Hələ icra olmayıb</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Son yenilənmə</div>
            <div className="mt-0.5">
              {rule.yenilendi && <span><Calendar className="mr-1 inline h-3 w-3" />{formatDate(rule.yenilendi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            İcra tarixçəsi (son 50)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rule.avto_log.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Hələ icra yoxdur. Yuxarıdakı &ldquo;Test&rdquo; düyməsi ilə yoxlayın.</p>
          ) : (
            <div className="divide-y divide-border/30">
              {rule.avto_log.map((l) => {
                const sm = l.shert_match as { matched?: number; target?: string; dry_run?: boolean } | null;
                return (
                  <div key={String(l.id)} className="flex flex-wrap items-center gap-3 px-4 py-2 text-xs">
                    <span className="w-32 shrink-0 truncate text-[10.5px] text-muted-foreground">
                      {l.yaradildi && formatDate(l.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Badge variant="outline" className={cn("text-[10px]",
                      l.status === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-rose-500/30 bg-rose-500/10 text-rose-500"
                    )}>
                      {l.status === "ok" ? <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /> : <XCircle className="mr-0.5 h-2.5 w-2.5" />}
                      {l.status ?? "?"}
                    </Badge>
                    {sm?.dry_run && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-500">DRY RUN</Badge>}
                    {sm?.matched != null && (
                      <span className="text-[10.5px]">
                        <strong>{sm.matched}</strong> {sm.target ?? "obyekt"}
                      </span>
                    )}
                    {l.xeta_metn && <span className="max-w-[30ch] truncate text-[10.5px] text-rose-500">{l.xeta_metn}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <BackButton fallback="/avtomatlasdirma" label="Bütün qaydalar" />
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "primary" | "emerald" | "amber" | "rose" | "neutral";
}) {
  const cls = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-500",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-500",
    neutral: "border-border bg-card/40",
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-75">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
