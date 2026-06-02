"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Workflow, Zap, Play, Power, Trash2, Loader2, Edit3, Repeat, AlertTriangle, CheckCircle2, Copy, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { toggleRule, deleteRule, testRule, cloneRule, runRuleNow } from "../actions";
import { TRIGGERS, MODULLAR, PRIORITY_META, ACTIONS } from "../catalog";

type Props = {
  rule: {
    id: number;
    ad: string;
    tesvir: string | null;
    modul: string | null;
    trigger_kod: string;
    prioritet: string | null;
    aktiv: boolean | null;
    sistem_qayda: boolean | null;
    son_islem: Date | null;
    islem_say: number | null;
    yaradildi: Date | null;
    tekrarlanma?: string | null;
    action_json?: unknown;
    _count: { avto_log: number };
  };
  view?: "card" | "list";
};

export function RuleCard({ rule, view = "card" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const trigger = TRIGGERS.find((t) => t.kod === rule.trigger_kod);
  const modulMeta = rule.modul ? MODULLAR[rule.modul as keyof typeof MODULLAR] : null;
  const priorityMeta = PRIORITY_META[(rule.prioritet ?? "orta") as keyof typeof PRIORITY_META];

  // Decode action_json to show what the rule does
  const actionJson = rule.action_json && typeof rule.action_json === "object"
    ? (rule.action_json as { actions?: { kod: string }[] })
    : null;
  const actionList = (actionJson?.actions ?? []).map((a) => ACTIONS.find((x) => x.kod === a.kod)).filter(Boolean);

  function onToggle() {
    startTransition(async () => {
      const r = await toggleRule(rule.id, !rule.aktiv);
      if (r.ok) {
        toast.success(rule.aktiv ? "Söndürüldü" : "Aktivləşdirildi");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function onTest() {
    startTransition(async () => {
      const r = await testRule(rule.id);
      if (r.ok) {
        const msg = r.matched > 0
          ? `${r.matched} ${r.target_label} tapıldı`
          : `Heç bir uyğunluq tapılmadı`;
        toast.success(msg + (r.risk_note ? ` · ${r.risk_note}` : ""), { duration: 7000 });
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function onDelete() {
    if (rule.sistem_qayda) {
      toast.error("Sistem qaydası silinə bilməz");
      return;
    }
    if (!confirm(`"${rule.ad}" silinsin?`)) return;
    startTransition(async () => {
      const r = await deleteRule(rule.id);
      if (r.ok) {
        toast.success("Silindi");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function onClone() {
    startTransition(async () => {
      const r = await cloneRule(rule.id);
      if (r.ok) {
        toast.success("Klonlandı — passiv vəziyyətdə yaradıldı");
        if (r.id) router.push(`/avtomatlasdirma/${r.id}`);
        else router.refresh();
      } else toast.error(r.error);
    });
  }

  function onRunNow() {
    if (!rule.aktiv) {
      toast.error("Əvvəlcə qaydanı aktivləşdirin");
      return;
    }
    if (!confirm(`"${rule.ad}" qaydasını indi icra et?\n\nNəticələr DB-yə yazılacaq (xəbərdarlıq və ya təsdiq sorğusu yarana bilər).`)) return;
    startTransition(async () => {
      const r = await runRuleNow(rule.id);
      if (r.ok) {
        const msg = r.alertsCreated > 0
          ? `${r.matched} uyğunluq · ${r.alertsCreated} xəbərdarlıq yaradıldı`
          : `${r.matched} uyğunluq tapıldı`;
        toast.success(msg, { duration: 7000 });
        router.refresh();
      } else toast.error(r.error);
    });
  }

  if (view === "list") {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 transition hover:border-primary/40", !rule.aktiv && "opacity-60", rule.aktiv ? "border-border bg-card/40" : "border-border/40 bg-secondary/20")}>
        <div className={cn("h-2 w-2 shrink-0 rounded-full", rule.aktiv ? "bg-emerald-500" : "bg-muted-foreground/40")} />
        <div className="min-w-0 flex-1">
          <Link href={`/avtomatlasdirma/${rule.id}`} className="block font-semibold hover:underline">
            {rule.ad}
          </Link>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
            <span><Zap className="mr-0.5 inline h-2.5 w-2.5" />{trigger?.ad ?? rule.trigger_kod}</span>
            {modulMeta && <Badge variant="outline" className={cn("text-[9px]", modulMeta.reng)}>{modulMeta.ad}</Badge>}
            <Badge variant="outline" className={cn("text-[9px]", priorityMeta.cls)}>{priorityMeta.ad}</Badge>
            <span>· {rule._count.avto_log} icra</span>
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onTest} disabled={pending} className="h-7 px-2 text-xs" title="Dry-run">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onRunNow} disabled={pending || !rule.aktiv} className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400" title="İndi icra et">
            <Rocket className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggle} disabled={pending} className="h-7 px-2 text-xs" title={rule.aktiv ? "Söndür" : "Aktivləşdir"}>
            <Power className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onClone} disabled={pending} className="h-7 px-2 text-xs" title="Klonla">
            <Copy className="h-3 w-3" />
          </Button>
          <Link href={`/avtomatlasdirma/${rule.id}`}>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" title="Redaktə">
              <Edit3 className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("glass transition hover:border-primary/40", !rule.aktiv && "opacity-70")}>
      <CardContent className="space-y-2.5 py-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 shrink-0 text-primary" />
              <Link href={`/avtomatlasdirma/${rule.id}`} className="truncate font-semibold hover:underline">
                {rule.ad}
              </Link>
              {rule.sistem_qayda && <Badge variant="outline" className="text-[9px]">sistem</Badge>}
            </div>
            {rule.tesvir && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{rule.tesvir}</p>}
          </div>
          <Badge variant="outline" className={cn("text-[9px] shrink-0",
            rule.aktiv ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-border bg-secondary text-muted-foreground"
          )}>
            <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {rule.aktiv ? "AKTİV" : "DEAKTİV"}
          </Badge>
        </div>

        {/* Trigger + module + priority */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="bg-secondary/40 text-[10px]">
            <Zap className="mr-0.5 h-2.5 w-2.5" />
            {trigger?.ad ?? rule.trigger_kod}
          </Badge>
          {modulMeta && <Badge variant="outline" className={cn("text-[10px]", modulMeta.reng)}>{modulMeta.ad}</Badge>}
          <Badge variant="outline" className={cn("text-[10px]", priorityMeta.cls)}>{priorityMeta.ad}</Badge>
        </div>

        {/* Action chips */}
        {actionList.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">→ icra:</span>
            {actionList.slice(0, 4).map((a) => a && (
              <Badge key={a.kod} variant="secondary" className="text-[9px]">
                {a.ad}
              </Badge>
            ))}
            {actionList.length > 4 && <span className="text-[10px] text-muted-foreground">+{actionList.length - 4}</span>}
          </div>
        )}

        {/* Schedule + stats */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-[10.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Repeat className="h-2.5 w-2.5" />
            {rule.tekrarlanma ?? "realtime"}
          </span>
          <span>{rule._count.avto_log} icra</span>
          <span>
            {rule.son_islem
              ? `Son: ${formatDate(rule.son_islem, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
              : "İcra olmayıb"}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <Button size="sm" variant="outline" disabled={pending} onClick={onTest} className="h-7 gap-1 text-[11px]" title="Dry-run — heç bir nəticə yazılmır">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Test
          </Button>
          <Button size="sm" variant="outline" disabled={pending || !rule.aktiv} onClick={onRunNow} className="h-7 gap-1 text-[11px] border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400" title="İndi icra et — nəticə DB-yə yazılır">
            <Rocket className="h-3 w-3" />
            İndi
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={onToggle} className="h-7 gap-1 text-[11px]">
            <Power className="h-3 w-3" />
            {rule.aktiv ? "Söndür" : "Aktivləşdir"}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={onClone} className="h-7 gap-1 text-[11px]" title="Bu qaydanı kopyala">
            <Copy className="h-3 w-3" />
          </Button>
          <Link href={`/avtomatlasdirma/${rule.id}`} className="ml-auto">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
              <Edit3 className="h-3 w-3" />
              Redaktə
            </Button>
          </Link>
          {!rule.sistem_qayda && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={onDelete} className="h-7 px-2 text-rose-500 hover:bg-rose-500/10">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Tiny stat component for the activity sidebar */
export function RuleHealthIcon({ aktiv, errors }: { aktiv: boolean; errors: number }) {
  if (!aktiv) return <Power className="h-3 w-3 text-muted-foreground" />;
  if (errors > 0) return <AlertTriangle className="h-3 w-3 text-rose-500" />;
  return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
}
