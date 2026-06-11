"use client";

import { useState, useTransition } from "react";
import {
  TrendingUp, Settings, Plus, Trash2, Save, Loader2, X, CheckCircle2, AlertTriangle, Target,
  Wallet, Briefcase, ClipboardCheck, ShieldCheck, Coins, ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import type { BonusProfil, BonusPaylanma, BonusKategoriya } from "@/features/iscilier/bonus-profile";
import type { BonusHesablama } from "@/features/iscilier/bonus-calc";
import { saveBonusProfil } from "@/features/iscilier/bonus-profile-actions";

const KATEQ_LABEL: Record<BonusKategoriya, string> = {
  davamiyyet: "Davamiyyət",
  tapsiriq: "Tapşırıqlar",
  sehv_yoxlugu: "Səhvsiz",
  borc_yigim: "Borc yığımı",
  satis_hedef: "Satış hədəfi",
};
const KATEQ_DESC: Record<BonusKategoriya, string> = {
  davamiyyet: "İş günü davamiyyəti",
  tapsiriq: "Vaxtında bitirilən tapşırıqlar",
  sehv_yoxlugu: "Rədd edilməyən sorğular",
  borc_yigim: "Borcun yığılan faizi",
  satis_hedef: "Aylıq satış məbləği",
};
const KATEQ_ICON: Record<BonusKategoriya, React.ComponentType<{ className?: string }>> = {
  davamiyyet: ClipboardCheck,
  tapsiriq: Briefcase,
  sehv_yoxlugu: ShieldCheck,
  borc_yigim: Coins,
  satis_hedef: ShoppingCart,
};
const HEDEF_VAHID: Record<BonusKategoriya, "faiz" | "mebleg"> = {
  davamiyyet: "faiz",
  tapsiriq: "faiz",
  sehv_yoxlugu: "faiz",
  borc_yigim: "faiz",
  satis_hedef: "mebleg",
};
const ALL_KATEQ: BonusKategoriya[] = ["davamiyyet", "tapsiriq", "sehv_yoxlugu", "borc_yigim", "satis_hedef"];

const MONTH_LABELS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

export function BonusOverview({
  istifadeciId,
  profile,
  result,
  canEdit,
}: {
  istifadeciId: string;
  profile: BonusProfil;
  result: BonusHesablama | null;
  canEdit: boolean;
}) {
  const pool = result?.pool_mebleg ?? 0;
  const qazanilan = result?.qazanilan_cemi ?? 0;
  const cemPct = pool > 0 ? Math.min(100, Math.round((qazanilan / pool) * 100)) : 0;
  const monthLabel = result ? `${MONTH_LABELS[result.ay - 1]} ${result.il}` : "";

  // Empty state
  if (!result || (result.kateqoriyalar.length === 0 && pool === 0)) {
    return (
      <Card className="glass">
        <CardContent className="py-10 text-center">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-base font-bold">Bonus profili konfiqurə edilməyib</h3>
          <p className="mt-1 max-w-md mx-auto text-xs text-muted-foreground">
            Bu əməkdaş üçün hələ bonus qaydası təyin edilməyib.
            Sahibkar konfiqurasiya etdikdən sonra burada cari ayın bonus hesabı canlı görünəcək.
          </p>
          {canEdit && (
            <EditDialog
              istifadeciId={istifadeciId}
              initial={profile}
              trigger={
                <Button className="mt-4" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Bonus qaydası yarat
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass overflow-hidden border-emerald-500/20">
      {/* Hero — Big number + Pool + Edit */}
      <div className="relative bg-gradient-to-br from-emerald-500/10 via-card to-primary/5 px-5 py-5">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Bonus · {monthLabel}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
              <div className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(qazanilan)}
              </div>
              <div className="text-xs text-muted-foreground">
                / {formatMoney(pool)} pool
              </div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {methodLabel(profile)}
            </div>
            {/* QA-orta: profil bonusu bordroya (kpi_bonus) avtomatik yazılmır —
                yanlış maaş gözləntisi yaranmasın deyə simulyasiya etiketi */}
            <div className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-500">
              Təxmini hesablama — bordroya avtomatik əlavə olunmur
            </div>
          </div>
          {canEdit && (
            <EditDialog
              istifadeciId={istifadeciId}
              initial={profile}
              trigger={
                <Button variant="outline" size="sm" className="shrink-0">
                  <Settings className="h-3.5 w-3.5" />
                  Qaydaları düzəlt
                </Button>
              }
            />
          )}
        </div>

        {/* Overall progress bar */}
        <div className="relative mt-4 space-y-1">
          <div className="flex items-center justify-between text-[10.5px] font-semibold text-muted-foreground">
            <span>Bu ay tamamlanma</span>
            <span className="tabular-nums text-foreground">{cemPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-primary transition-all"
              style={{ width: `${cemPct}%` }}
            />
          </div>
          {result.paylanmayan_mebleg > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {formatMoney(result.paylanmayan_mebleg)} pool-dan kateqoriyaya paylanmayıb
            </p>
          )}
        </div>
      </div>

      {/* Category rows — compact */}
      <CardContent className="p-0">
        <div className="divide-y divide-border/30">
          {result.kateqoriyalar.map((k) => {
            const pct = Math.min(100, Math.round(k.nailiyyet_faiz));
            const tone =
              pct >= 100 ? "emerald" : pct >= 70 ? "amber" : "rose";
            const Icon = KATEQ_ICON[k.kateqoriya] ?? Target;
            const StatusIcon = pct >= 100 ? CheckCircle2 : pct >= 70 ? Target : AlertTriangle;
            const toneColors: Record<typeof tone, { text: string; bar: string; bg: string }> = {
              emerald: { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/10" },
              amber: { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", bg: "bg-amber-500/10" },
              rose: { text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", bg: "bg-rose-500/10" },
            };
            const c = toneColors[tone];

            return (
              <div key={k.kateqoriya} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/20">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${c.bg} ${c.text}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{KATEQ_LABEL[k.kateqoriya]}</span>
                    <StatusIcon className={`h-3 w-3 ${c.text}`} />
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    Faktiki:{" "}
                    <span className="tabular-nums font-medium text-foreground">
                      {k.hedef_vahid === "mebleg" ? formatMoney(k.faktiki) : `${k.faktiki.toFixed(1)}%`}
                    </span>
                    {" · "}
                    Hədəf:{" "}
                    <span className="tabular-nums">
                      {k.hedef_vahid === "mebleg" ? formatMoney(k.hedef) : `${k.hedef}%`}
                    </span>
                  </div>
                </div>
                <div className="hidden w-24 sm:block">
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
                    <div className={`h-full ${c.bar} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={`mt-0.5 text-right text-[10px] font-bold tabular-nums ${c.text}`}>
                    {pct}%
                  </div>
                </div>
                <div className="w-24 text-right">
                  <div className={`text-base font-bold tabular-nums ${c.text}`}>
                    {formatMoney(k.qazanilan_mebleg)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    / {formatMoney(k.pay_meblegh)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function methodLabel(p: BonusProfil): string {
  if (p.metod === "fixed") return `Sabit pool: ${formatMoney(p.fixed_mebleg)}`;
  if (p.metod === "percent_satis") return `Satışın ${p.percent}%-i`;
  return `Mənfəətin ${p.percent}%-i`;
}

/** Düzəliş dialogu — sahibkar / admin görür */
function EditDialog({
  istifadeciId,
  initial,
  trigger,
}: {
  istifadeciId: string;
  initial: BonusProfil;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<BonusProfil>(initial);
  const [pending, startTransition] = useTransition();

  function addRow() {
    const used = new Set(profile.paylanma.map((p) => p.kateqoriya));
    const next = ALL_KATEQ.find((k) => !used.has(k));
    if (!next) {
      toast.info("Bütün kateqoriyalar artıq əlavə edilib");
      return;
    }
    setProfile((p) => ({
      ...p,
      paylanma: [
        ...p.paylanma,
        { kateqoriya: next, tip: "mebleg", deyer: 0, hedef: HEDEF_VAHID[next] === "faiz" ? 90 : 0 },
      ],
    }));
  }

  function updateRow(idx: number, patch: Partial<BonusPaylanma>) {
    setProfile((p) => ({
      ...p,
      paylanma: p.paylanma.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
  }

  function removeRow(idx: number) {
    setProfile((p) => ({ ...p, paylanma: p.paylanma.filter((_, i) => i !== idx) }));
  }

  function onSave() {
    startTransition(async () => {
      const res = await saveBonusProfil({
        istifadeciId,
        metod: profile.metod,
        fixed_mebleg: profile.fixed_mebleg,
        percent: profile.percent,
        paylanma: profile.paylanma,
      });
      if (res.ok) {
        toast.success("Yadda saxlandı");
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  const usedSlots = new Set(profile.paylanma.map((p) => p.kateqoriya));
  const fixedSum = profile.paylanma.filter((p) => p.tip === "mebleg").reduce((s, p) => s + p.deyer, 0);
  const percentSum = profile.paylanma.filter((p) => p.tip === "faiz").reduce((s, p) => s + p.deyer, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Bonus qaydası
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 1. Metod — 3 düymə */}
          <section>
            <Label className="mb-1.5 block text-xs font-bold">1. Bonus haradan gəlir?</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { v: "fixed", label: "Sabit ₼", desc: "Standart məbləğ" },
                { v: "percent_satis", label: "Satışdan %", desc: "Dövriyyə bazlı" },
                { v: "percent_menfaat", label: "Mənfəətdən %", desc: "Real xeyir" },
              ] as const).map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, metod: m.v }))}
                  className={`rounded-lg border px-2 py-2.5 text-center transition ${
                    profile.metod === m.v
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border hover:bg-secondary/30"
                  }`}
                >
                  <div className="text-xs font-bold">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2 rounded-md bg-secondary/30 px-3 py-2">
              {profile.metod === "fixed" ? (
                <>
                  <Label className="text-xs text-muted-foreground">Aylıq pool:</Label>
                  <input
                    type="number"
                    value={profile.fixed_mebleg}
                    onChange={(e) => setProfile((p) => ({ ...p, fixed_mebleg: Number(e.target.value || 0) }))}
                    min={0}
                    max={1_000_000}
                    className="h-8 w-32 rounded border border-input bg-background px-2 text-right text-sm font-bold tabular-nums"
                  />
                  <span className="text-sm font-bold">₼</span>
                </>
              ) : (
                <>
                  <Label className="text-xs text-muted-foreground">Faiz:</Label>
                  <input
                    type="number"
                    value={profile.percent}
                    onChange={(e) => setProfile((p) => ({ ...p, percent: Number(e.target.value || 0) }))}
                    min={0}
                    max={100}
                    step={0.5}
                    className="h-8 w-20 rounded border border-input bg-background px-2 text-right text-sm font-bold tabular-nums"
                  />
                  <span className="text-sm font-bold">%</span>
                  <span className="text-[10.5px] text-muted-foreground">
                    {profile.metod === "percent_satis" ? "aylıq satışdan" : "aylıq mənfəətdən"}
                  </span>
                </>
              )}
            </div>
          </section>

          {/* 2. Paylanma */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-xs font-bold">2. Bonusu kateqoriyalara böl</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                disabled={usedSlots.size >= ALL_KATEQ.length}
              >
                <Plus className="h-3 w-3" />
                Kateqoriya
              </Button>
            </div>

            {profile.paylanma.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Bonus pool-u kateqoriyalara bölmək üçün <strong>+ Kateqoriya</strong> bas
              </div>
            ) : (
              <div className="space-y-1.5">
                {profile.paylanma.map((row, idx) => {
                  const hedefVahidLbl = HEDEF_VAHID[row.kateqoriya] === "faiz" ? "%" : "₼";
                  const Icon = KATEQ_ICON[row.kateqoriya];
                  return (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-2.5 py-2"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <select
                        value={row.kateqoriya}
                        onChange={(e) => {
                          const nextK = e.target.value as BonusKategoriya;
                          updateRow(idx, {
                            kateqoriya: nextK,
                            hedef: HEDEF_VAHID[nextK] === "faiz" ? 90 : 0,
                          });
                        }}
                        className="h-8 min-w-[120px] flex-1 rounded border border-input bg-background px-2 text-xs"
                      >
                        {ALL_KATEQ.map((k) => (
                          <option key={k} value={k} disabled={usedSlots.has(k) && k !== row.kateqoriya}>
                            {KATEQ_LABEL[k]}
                          </option>
                        ))}
                      </select>

                      <span className="text-[10px] text-muted-foreground">verilir:</span>
                      <input
                        type="number"
                        value={row.deyer}
                        onChange={(e) => updateRow(idx, { deyer: Number(e.target.value || 0) })}
                        min={0}
                        max={1_000_000}
                        className="h-8 w-20 rounded border border-input bg-background px-1.5 text-right text-xs tabular-nums"
                      />
                      <select
                        value={row.tip}
                        onChange={(e) => updateRow(idx, { tip: e.target.value as "mebleg" | "faiz" })}
                        className="h-8 rounded border border-input bg-background px-1.5 text-[11px]"
                      >
                        <option value="mebleg">₼</option>
                        <option value="faiz">%</option>
                      </select>

                      <span className="text-[10px] text-muted-foreground">hədəf:</span>
                      <input
                        type="number"
                        value={row.hedef}
                        onChange={(e) => updateRow(idx, { hedef: Number(e.target.value || 0) })}
                        min={0}
                        max={1_000_000}
                        className="h-8 w-20 rounded border border-input bg-background px-1.5 text-right text-xs tabular-nums"
                      />
                      <span className="text-[10px] text-muted-foreground">{hedefVahidLbl}</span>

                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                        title="Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {profile.paylanma.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 text-[10.5px]">
                {fixedSum > 0 && (
                  <Badge variant="outline">
                    Sabit cəm: <span className="ml-1 font-bold tabular-nums">{fixedSum} ₼</span>
                  </Badge>
                )}
                {percentSum > 0 && (
                  <Badge variant="outline" className={percentSum > 100 ? "border-rose-500/40 text-rose-500" : ""}>
                    Faiz cəm: <span className="ml-1 font-bold tabular-nums">{percentSum}%</span>
                    {percentSum > 100 && " ⚠"}
                  </Badge>
                )}
              </div>
            )}
          </section>

          {/* Mini izahlar */}
          <section className="rounded-md border border-border/40 bg-secondary/20 p-3 text-[10.5px] text-muted-foreground">
            <p className="font-bold text-foreground">📖 Necə işləyir?</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Hər kateqoriyaya pay verilir (₼ və ya pool-dan %)</li>
              <li>Hədəfə nail olunmazsa, pay proporsional azalır (məs. 80% nail oldu → 80% pay)</li>
              <li>Hədəf keçilsə tam pay verilir (limit 100%)</li>
              <li>Boş kateqoriya = ümumi pool-da qalır (paylanmamış)</li>
            </ul>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            <X className="h-3.5 w-3.5" />
            İmtina
          </Button>
          <Button onClick={onSave} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Yadda saxla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
