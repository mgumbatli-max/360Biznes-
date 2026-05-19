"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { formatMoney } from "@/lib/utils";
import {
  saveCommissionRules,
  calculateCommission,
} from "../commission-actions";
import type { CommissionTier } from "../commission-queries";

export function CommissionRulesForm({
  initialTiers,
  initialBonus,
}: {
  initialTiers: CommissionTier[];
  initialBonus: number;
}) {
  const router = useRouter();
  const [tiers, setTiers] = useState<CommissionTier[]>(
    initialTiers.length > 0 ? initialTiers : [{ from: 0, percent: 1 }],
  );
  const [bonus, setBonus] = useState(initialBonus);
  const [saving, startSave] = useTransition();
  const [calculating, startCalc] = useTransition();

  const today = new Date();
  const [calcYear, setCalcYear] = useState(today.getFullYear());
  const [calcMonth, setCalcMonth] = useState(today.getMonth() + 1);

  function setTier(i: number, key: keyof CommissionTier, val: number) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: val } : t)));
  }

  function addTier() {
    const lastFrom = tiers.length > 0 ? tiers[tiers.length - 1].from : 0;
    setTiers((prev) => [...prev, { from: lastFrom + 5000, percent: 2 }]);
  }

  function removeTier(i: number) {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit() {
    startSave(async () => {
      const r = await saveCommissionRules({ tiers, bonus_on_target: bonus });
      if (r.ok) {
        toast.success("Qaydalar yadda saxlanıldı");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function runCalc() {
    startCalc(async () => {
      const r = await calculateCommission(calcYear, calcMonth);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `Hesablandı: ${r.updated} işçi yeniləndi · ${r.skipped} keçildi (ödənilmiş)`,
      );
    });
  }

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Mərhələli komissiya cədvəli</h3>
            <Button size="sm" variant="outline" onClick={addTier}>
              <Plus className="h-3.5 w-3.5" />
              Mərhələ
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2">Aylıq satış (AZN-dən başlayaraq)</th>
                  <th className="py-2 pr-2">Komissiya %</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 pr-2">
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={t.from}
                        onChange={(e) =>
                          setTier(i, "from", Math.max(0, Number(e.target.value) || 0))
                        }
                        className="h-8"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        value={t.percent}
                        onChange={(e) =>
                          setTier(
                            i,
                            "percent",
                            Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          )
                        }
                        className="h-8 w-24 text-right"
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeTier(i)}
                        disabled={tiers.length <= 1}
                        className="text-muted-foreground hover:text-danger disabled:opacity-40"
                        aria-label="Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Hədəfə çatdıqda bonus (AZN)
              </label>
              <Input
                type="number"
                step="any"
                min={0}
                value={bonus}
                onChange={(e) => setBonus(Math.max(0, Number(e.target.value) || 0))}
                className="h-9"
              />
              <div className="mt-1 text-[11px] text-muted-foreground">
                Aylıq hədəfə çatan satıcıya əlavə bonus
              </div>
            </div>
          </div>

          <Button size="sm" onClick={submit} disabled={saving} className="font-semibold">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Yadda saxla
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="space-y-2 py-4">
          <h3 className="text-sm font-semibold">Aylıq bağlama: komissiya hesabla</h3>
          <p className="text-xs text-muted-foreground">
            Bütün satıcılar üçün ay üzrə komissiyanı hesablayır və{" "}
            <code>maas_hesablamalar.kpi_bonus</code> sahəsinə yazır. Statusu &ldquo;cernovik&rdquo;{" "}
            olan sətrlər yenilənir.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">İl</label>
              <Input
                type="number"
                value={calcYear}
                onChange={(e) => setCalcYear(Number(e.target.value) || today.getFullYear())}
                className="h-8 w-24"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Ay</label>
              <Input
                type="number"
                min={1}
                max={12}
                value={calcMonth}
                onChange={(e) =>
                  setCalcMonth(Math.max(1, Math.min(12, Number(e.target.value) || 1)))
                }
                className="h-8 w-16"
              />
            </div>
            <Button size="sm" variant="outline" onClick={runCalc} disabled={calculating}>
              {calculating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Calculator className="h-3.5 w-3.5" />
              )}
              Hesabla & yaz
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="space-y-2 py-4">
          <h3 className="text-sm font-semibold">Nümunə hesablama</h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            <PreviewRow tiers={tiers} bonus={bonus} amount={3000} />
            <PreviewRow tiers={tiers} bonus={bonus} amount={7500} />
            <PreviewRow tiers={tiers} bonus={bonus} amount={15000} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewRow({ tiers, bonus, amount }: { tiers: CommissionTier[]; bonus: number; amount: number }) {
  // Re-implement marginal calc client-side for preview
  const sorted = [...tiers].sort((a, b) => a.from - b.from);
  let commission = 0;
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i].from;
    const next = i + 1 < sorted.length ? sorted[i + 1].from : Infinity;
    if (amount <= from) break;
    commission += (Math.min(amount, next) - from) * (sorted[i].percent / 100);
  }
  commission = Math.round(commission * 100) / 100;
  return (
    <div className="flex items-center justify-between rounded-md bg-secondary/30 px-2 py-1">
      <span>Satış {formatMoney(amount)}</span>
      <span className="tabular-nums">
        Komissiya: <strong>{formatMoney(commission)}</strong> · Hədəf bonusu:{" "}
        <strong>{formatMoney(bonus)}</strong>
      </span>
    </div>
  );
}
