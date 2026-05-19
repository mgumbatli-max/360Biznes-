"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Loader2, ChevronRight, Trash2, Sparkles, Power, Save, Zap, Filter, Target, Bell,
  Repeat, FlaskConical, Check,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createRule } from "../actions";
import {
  TRIGGERS, MODULLAR, SHERT_META, ACTIONS, SCOPES, SCHEDULES, RECIPIENTS, KANALLAR,
  RULE_TEMPLATES, TEMPLATE_VARIABLES, PRIORITY_META,
  type TriggerKod, type ShertField, type ShertOperator, type ShertGroup,
  type ActionKod, type ScopeKod, type ScheduleKod, type RecipientKod, type KanalKod, type Prioritet,
} from "../catalog";

type FormState = {
  ad: string;
  tesvir: string;
  trigger_kod: TriggerKod | "";
  prioritet: Prioritet;
  aktiv: boolean;
  shert: ShertGroup;
  scope: { type: ScopeKod }[];
  actions: ActionKod[];
  notification: {
    recipients: RecipientKod[];
    channels: KanalKod[];
    template: string;
  };
  schedule: ScheduleKod;
};

const STEPS = [
  { id: 1, label: "Ümumi",  icon: Sparkles },
  { id: 2, label: "Hadisə", icon: Zap },
  { id: 3, label: "Şərt",   icon: Filter },
  { id: 4, label: "Sahə",   icon: Target },
  { id: 5, label: "Əməliyyat", icon: Bell },
  { id: 6, label: "Vaxt",   icon: Repeat },
];

const EMPTY_STATE: FormState = {
  ad: "",
  tesvir: "",
  trigger_kod: "",
  prioritet: "orta",
  aktiv: true,
  shert: { logic: "and", conditions: [] },
  scope: [{ type: "all" }],
  actions: ["xeberdarliq"],
  notification: {
    recipients: ["sahibkar"],
    channels: ["erp"],
    template: "",
  },
  schedule: "realtime",
};

export function RuleBuilder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [state, setState] = useState<FormState>(EMPTY_STATE);
  const [pending, startTransition] = useTransition();

  const trigger = state.trigger_kod ? TRIGGERS.find((t) => t.kod === state.trigger_kod) : undefined;

  const reset = () => {
    setStep(1);
    setState(EMPTY_STATE);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const applyTemplate = (id: string) => {
    const tpl = RULE_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setState({
      ...EMPTY_STATE,
      ad: tpl.ad,
      tesvir: tpl.tesvir,
      trigger_kod: tpl.trigger,
      prioritet: tpl.prioritet,
      shert: tpl.defaults.shert ?? EMPTY_STATE.shert,
      scope: tpl.defaults.scope?.map((s) => ({ type: s.type })) ?? EMPTY_STATE.scope,
      actions: tpl.defaults.actions?.map((a) => a.kod) ?? EMPTY_STATE.actions,
      notification: EMPTY_STATE.notification,
      schedule: tpl.defaults.schedule ?? EMPTY_STATE.schedule,
    });
    toast.success(`Şablon tətbiq edildi: ${tpl.ad}`);
    setStep(2);
  };

  const next = () => setStep((s) => Math.min(6, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = () => {
    if (!state.ad.trim()) {
      toast.error("Qayda adı tələb olunur");
      setStep(1);
      return;
    }
    if (!state.trigger_kod) {
      toast.error("Hadisə seçilməyib");
      setStep(2);
      return;
    }
    if (state.actions.length === 0) {
      toast.error("Ən azı 1 əməliyyat seçin");
      setStep(5);
      return;
    }
    startTransition(async () => {
      const res = await createRule({
        ad: state.ad,
        tesvir: state.tesvir || undefined,
        trigger_kod: state.trigger_kod,
        modul: trigger?.modul,
        prioritet: state.prioritet,
        aktiv: state.aktiv,
        shert: state.shert,
        scope: state.scope,
        actions: state.actions.map((kod) => ({ kod })),
        notification: state.notification,
        schedule: state.schedule,
      });
      if (res.ok) {
        toast.success("Qayda yaradıldı");
        close();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTimeout(reset, 300); }}>
      <DialogTrigger asChild>
        <Button className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni qayda
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avtomatlaşdırma qaydası — addım {step}/6</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <nav className="flex flex-wrap items-center gap-1 border-b border-border/40 pb-3">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const active = s.id === step;
            const done = s.id < step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition",
                  active ? "bg-foreground text-background" : done ? "text-emerald-500" : "text-muted-foreground hover:bg-secondary/40"
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{s.label}</span>
                {idx < STEPS.length - 1 && <ChevronRight className="h-3 w-3 opacity-50" />}
              </button>
            );
          })}
        </nav>

        {/* Step body */}
        <div className="space-y-4 py-2">
          {step === 1 && <Step1 state={state} setState={setState} onTemplate={applyTemplate} />}
          {step === 2 && <Step2 state={state} setState={setState} />}
          {step === 3 && <Step3 state={state} setState={setState} />}
          {step === 4 && <Step4 state={state} setState={setState} />}
          {step === 5 && <Step5 state={state} setState={setState} />}
          {step === 6 && <Step6 state={state} setState={setState} />}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={close} disabled={pending}>İmtina</Button>
          <div className="flex gap-2">
            {step > 1 && <Button variant="outline" onClick={back} disabled={pending}>Geri</Button>}
            {step < 6 && <Button onClick={next} disabled={pending}>
              İrəli <ChevronRight className="h-3 w-3" />
            </Button>}
            {step === 6 && (
              <Button onClick={submit} disabled={pending}>
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Qaydanı yarat
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* STEP 1 — Info + templates */
function Step1({ state, setState, onTemplate }: { state: FormState; setState: (s: FormState) => void; onTemplate: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {/* Templates */}
      <div>
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Hazır şablonlar (sürətli başlanğıc)</div>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {RULE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTemplate(t.id)}
              className="rounded-md border border-border bg-card/40 px-3 py-2 text-left transition hover:border-primary/40 hover:bg-secondary/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{t.ad}</span>
                <Badge variant="outline" className={cn("text-[9px]", PRIORITY_META[t.prioritet].cls)}>{PRIORITY_META[t.prioritet].ad}</Badge>
              </div>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">{t.tesvir}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border/40" />

      {/* Manual fields */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Qayda adı *</label>
          <Input value={state.ad} onChange={(e) => setState({ ...state, ad: e.target.value })} placeholder="Məs. Stok 5-dən aşağı düşdü" className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Təsvir</label>
          <textarea
            value={state.tesvir}
            onChange={(e) => setState({ ...state, tesvir: e.target.value })}
            rows={2}
            placeholder="Qaydanın nə üçün olduğunu qısa izah edin"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prioritet</label>
            <div className="mt-1 flex gap-1">
              {(Object.keys(PRIORITY_META) as Prioritet[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setState({ ...state, prioritet: p })}
                  className={cn(
                    "inline-flex h-9 flex-1 items-center justify-center rounded-md border text-xs font-semibold transition",
                    state.prioritet === p ? PRIORITY_META[p].cls : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {PRIORITY_META[p].ad}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</label>
            <button
              type="button"
              onClick={() => setState({ ...state, aktiv: !state.aktiv })}
              className={cn(
                "mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border font-semibold transition",
                state.aktiv ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-border bg-card text-muted-foreground"
              )}
            >
              <Power className="h-3.5 w-3.5" />
              {state.aktiv ? "Aktiv" : "Deaktiv"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* STEP 2 — Trigger picker grouped by modul */
function Step2({ state, setState }: { state: FormState; setState: (s: FormState) => void }) {
  const byModul = new Map<string, typeof TRIGGERS>();
  for (const t of TRIGGERS) {
    if (!byModul.has(t.modul)) byModul.set(t.modul, []);
    byModul.get(t.modul)!.push(t);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <strong>Hadisə</strong> qaydanın işə düşmə anıdır. Sistem bu hadisəni müşahidə edir və baş verəndə şərtə baxır.
      </div>
      {Array.from(byModul.entries()).map(([modul, triggers]) => (
        <div key={modul}>
          <div className="mb-1.5 flex items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px]", MODULLAR[modul as keyof typeof MODULLAR]?.reng)}>
              {MODULLAR[modul as keyof typeof MODULLAR]?.ad ?? modul}
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {triggers.map((t) => {
              const Icon = t.icon;
              const active = state.trigger_kod === t.kod;
              return (
                <button
                  key={t.kod}
                  type="button"
                  onClick={() => setState({ ...state, trigger_kod: t.kod })}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-3 py-2 text-left transition",
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border bg-card/40 hover:border-primary/40 hover:bg-secondary/40"
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold">{t.ad}</div>
                    <div className="text-[10.5px] text-muted-foreground">{t.tesvir}</div>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* STEP 3 — Condition constructor (AND/OR) */
function Step3({ state, setState }: { state: FormState; setState: (s: FormState) => void }) {
  const trigger = state.trigger_kod ? TRIGGERS.find((t) => t.kod === state.trigger_kod) : undefined;
  const availableFields = trigger?.shertler ?? (Object.keys(SHERT_META) as ShertField[]);

  const addCond = () => {
    const firstField = availableFields[0];
    if (!firstField) return;
    const meta = SHERT_META[firstField];
    setState({
      ...state,
      shert: {
        ...state.shert,
        conditions: [
          ...state.shert.conditions,
          { field: firstField, operator: meta.defaultOp, value: meta.defaultValue },
        ],
      },
    });
  };

  const updateCond = (idx: number, patch: Partial<typeof state.shert.conditions[number]>) => {
    const next = [...state.shert.conditions];
    next[idx] = { ...next[idx], ...patch };
    setState({ ...state, shert: { ...state.shert, conditions: next } });
  };

  const removeCond = (idx: number) => {
    setState({
      ...state,
      shert: { ...state.shert, conditions: state.shert.conditions.filter((_, i) => i !== idx) },
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
        <strong>Şərtlər</strong> qayda işə düşmədən öncə yoxlanır. Bütün şərtlər ödənməlidir (AND) və ya hər hansı biri kifayət edir (OR).
      </div>

      {/* Logic toggle */}
      <div className="flex gap-1 rounded-md border border-border bg-secondary/20 p-1">
        {(["and", "or"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setState({ ...state, shert: { ...state.shert, logic: l } })}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition",
              state.shert.logic === l ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/40"
            )}
          >
            {l === "and" ? "Bütün şərtlər ödənsə (AND)" : "Hər hansı biri ödənsə (OR)"}
          </button>
        ))}
      </div>

      {/* Conditions */}
      {state.shert.conditions.length === 0 && (
        <div className="rounded-md border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
          Şərt yoxdur — hadisə baş verəndə qayda hər zaman işə düşəcək. Aşağıdakı düymə ilə şərt əlavə edə bilərsiniz.
        </div>
      )}
      {state.shert.conditions.map((c, idx) => {
        const meta = SHERT_META[c.field as ShertField];
        return (
          <div key={idx} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/40 p-2">
            <select
              value={c.field}
              onChange={(e) => updateCond(idx, { field: e.target.value as ShertField })}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs font-medium"
            >
              {availableFields.map((f) => (
                <option key={f} value={f}>{SHERT_META[f].label}</option>
              ))}
            </select>
            <select
              value={c.operator}
              onChange={(e) => updateCond(idx, { operator: e.target.value as ShertOperator })}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs font-bold"
            >
              {(["=", ">", ">=", "<", "<=", "!="] as ShertOperator[]).map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
            <input
              type="number"
              value={c.value}
              onChange={(e) => updateCond(idx, { value: Number(e.target.value) })}
              className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm font-bold tabular-nums"
            />
            {meta?.suffix && <span className="text-xs text-muted-foreground">{meta.suffix}</span>}
            <Button size="sm" variant="ghost" onClick={() => removeCond(idx)} className="ml-auto h-8 px-2 text-rose-500 hover:bg-rose-500/10">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        );
      })}

      <Button variant="outline" size="sm" onClick={addCond} disabled={availableFields.length === 0}>
        <Plus className="h-3 w-3" /> Şərt əlavə et
      </Button>
    </div>
  );
}

/* STEP 4 — Scope */
function Step4({ state, setState }: { state: FormState; setState: (s: FormState) => void }) {
  const trigger = state.trigger_kod ? TRIGGERS.find((t) => t.kod === state.trigger_kod) : undefined;
  const allowed = trigger?.scopes ?? (Object.keys(SCOPES) as ScopeKod[]);

  const toggle = (sk: ScopeKod) => {
    const exists = state.scope.find((s) => s.type === sk);
    if (sk === "all") {
      setState({ ...state, scope: [{ type: "all" }] });
      return;
    }
    let next = state.scope.filter((s) => s.type !== "all");
    if (exists) next = next.filter((s) => s.type !== sk);
    else next = [...next, { type: sk }];
    if (next.length === 0) next = [{ type: "all" }];
    setState({ ...state, scope: next });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3 text-xs">
        <strong>Tətbiq sahəsi</strong> qaydanın hansı obyektlərə təsir edəcəyini müəyyən edir. &ldquo;Bütün sistem&rdquo; seçilibsə, qayda hər yerdə işləyir.
      </div>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
        {allowed.map((sk) => {
          const meta = SCOPES[sk];
          const Icon = meta.icon;
          const active = state.scope.some((s) => s.type === sk);
          return (
            <button
              key={sk}
              type="button"
              onClick={() => toggle(sk)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-medium transition",
                active ? "border-violet-500 bg-violet-500/10 text-violet-500" : "border-border bg-card/40 text-muted-foreground hover:border-violet-500/40 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.ad}
              {active && <Check className="ml-auto h-3 w-3" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* STEP 5 — Actions + notification */
function Step5({ state, setState }: { state: FormState; setState: (s: FormState) => void }) {
  const toggleAction = (kod: ActionKod) => {
    const exists = state.actions.includes(kod);
    setState({ ...state, actions: exists ? state.actions.filter((a) => a !== kod) : [...state.actions, kod] });
  };

  const toggleRecipient = (r: RecipientKod) => {
    const exists = state.notification.recipients.includes(r);
    setState({
      ...state,
      notification: {
        ...state.notification,
        recipients: exists ? state.notification.recipients.filter((x) => x !== r) : [...state.notification.recipients, r],
      },
    });
  };

  const toggleChannel = (c: KanalKod) => {
    const exists = state.notification.channels.includes(c);
    setState({
      ...state,
      notification: {
        ...state.notification,
        channels: exists ? state.notification.channels.filter((x) => x !== c) : [...state.notification.channels, c],
      },
    });
  };

  const insertVariable = (key: string) => {
    setState({
      ...state,
      notification: { ...state.notification, template: state.notification.template + key },
    });
  };

  const groupedActions = {
    bildiris: ACTIONS.filter((a) => a.group === "is"),
    kanal: ACTIONS.filter((a) => a.group === "kanal"),
    kpi: ACTIONS.filter((a) => a.group === "kpi"),
    diger: ACTIONS.filter((a) => a.group === "diger"),
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
        <strong>Əməliyyatlar</strong> qayda işə düşdükdə avtomatik icra olunan addımlardır. Bir neçə seçə bilərsiniz.
      </div>

      {/* Actions in groups */}
      {[
        { label: "İş axını", items: groupedActions.bildiris },
        { label: "Bildiriş kanalları", items: groupedActions.kanal },
        { label: "KPI", items: groupedActions.kpi },
        { label: "Digər", items: groupedActions.diger },
      ].map((group) => (
        <div key={group.label}>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((a) => {
              const Icon = a.icon;
              const active = state.actions.includes(a.kod);
              return (
                <button
                  key={a.kod}
                  type="button"
                  onClick={() => toggleAction(a.kod)}
                  title={a.tesvir}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
                    active ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-border bg-card/40 text-muted-foreground hover:border-emerald-500/40"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {a.ad}
                  {active && <Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="h-px bg-border/40" />

      {/* Notification recipients */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bildiriş kimə getsin</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(RECIPIENTS) as [RecipientKod, string][]).map(([k, label]) => {
            const active = state.notification.recipients.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleRecipient(k)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                  active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                )}
              >
                {label}
                {active && <Check className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Channels */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hansı kanal</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(KANALLAR) as [KanalKod, typeof KANALLAR[KanalKod]][]).map(([k, meta]) => {
            const Icon = meta.icon;
            const active = state.notification.channels.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleChannel(k)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                  active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
                {meta.ad}
                {active && <Check className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Template */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bildiriş şablonu</div>
        <textarea
          value={state.notification.template}
          onChange={(e) => setState({ ...state, notification: { ...state.notification, template: e.target.value } })}
          rows={3}
          placeholder="Məs: {{mehsul_ad}} stokda {{stok_qaliq}} ədəd qalıb. Tez sifariş verin."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              title={v.desc}
              className="rounded border border-border bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] hover:bg-secondary"
            >
              {v.key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* STEP 6 — Schedule + summary */
function Step6({ state, setState }: { state: FormState; setState: (s: FormState) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <strong>Vaxt</strong> qaydanın hansı sıxlıqla yoxlanacağını müəyyən edir.
      </div>

      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        {(Object.entries(SCHEDULES) as [ScheduleKod, typeof SCHEDULES[ScheduleKod]][]).map(([k, meta]) => {
          const Icon = meta.icon;
          const active = state.schedule === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setState({ ...state, schedule: k })}
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2 text-left transition",
                active ? "border-amber-500 bg-amber-500/10" : "border-border bg-card/40 hover:border-amber-500/40"
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold">{meta.ad}</div>
                <div className="text-[10.5px] text-muted-foreground">{meta.tesvir}</div>
              </div>
              {active && <Check className="h-3.5 w-3.5 text-amber-500" />}
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold">
          <FlaskConical className="h-3.5 w-3.5 text-primary" />
          Qayda xülasəsi
        </div>
        <dl className="space-y-1 text-xs">
          <SummaryRow label="Ad" value={state.ad || "—"} />
          <SummaryRow label="Hadisə" value={state.trigger_kod ? TRIGGERS.find((t) => t.kod === state.trigger_kod)?.ad ?? state.trigger_kod : "—"} />
          <SummaryRow label="Şərtlər" value={state.shert.conditions.length === 0 ? "Yoxdur" : `${state.shert.conditions.length} şərt (${state.shert.logic.toUpperCase()})`} />
          <SummaryRow label="Sahə" value={state.scope.map((s) => SCOPES[s.type].ad).join(", ")} />
          <SummaryRow label="Əməliyyatlar" value={state.actions.map((a) => ACTIONS.find((x) => x.kod === a)?.ad ?? a).join(" + ")} />
          <SummaryRow label="Vaxt" value={SCHEDULES[state.schedule].ad} />
          <SummaryRow label="Prioritet" value={PRIORITY_META[state.prioritet].ad} />
        </dl>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
