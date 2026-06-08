"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Percent, Save, Check } from "lucide-react";
import { setMarketplaceCommission } from "../marketplace-commission-actions";

const PLATFORM_LABEL: Record<string, string> = {
  bolt_food: "Bolt Food",
  wolt: "Wolt",
  yango_deli: "Yango Deli",
  tap_az: "Tap.az",
  umico: "Umico",
  birmarket: "Birmarket",
  trendyol: "Trendyol",
  amazon: "Amazon",
  noon: "Noon",
  progo: "ProGo",
  diger: "Digər",
};

export function MarketplaceCommissionEditor({
  initial,
}: {
  initial: Record<string, number>;
}) {
  const [values, setValues] = useState<Record<string, number>>(initial);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function save(platform: string) {
    const v = values[platform] ?? 0;
    setPendingPlatform(platform);
    startTransition(async () => {
      const fd = await setMarketplaceCommission(platform, v);
      if (fd.ok) {
        toast.success(`${PLATFORM_LABEL[platform] ?? platform}: ${v}% yaddaşa alındı`);
        setSavedAt((s) => ({ ...s, [platform]: Date.now() }));
      } else {
        toast.error(fd.error);
      }
      setPendingPlatform(null);
    });
  }

  const platforms = Object.keys(PLATFORM_LABEL);

  return (
    <section className="rounded-xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/15 text-sky-700">
          <Percent className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Platform default komissiya faizləri</h3>
          <p className="text-[10.5px] text-muted-foreground">
            Satış yaradılanda komissiya boş buraxılsa bu dəyər tətbiq olunur. Owner-spesifikdir.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {platforms.map((p) => {
          const recentSave = savedAt[p] && Date.now() - savedAt[p] < 3000;
          return (
            <div key={p} className="rounded-lg border border-border bg-background/40 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium">{PLATFORM_LABEL[p]}</span>
                {recentSave && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600">
                    <Check className="h-2.5 w-2.5" /> Yadda saxlandı
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={values[p] ?? 0}
                  onChange={(e) => setValues((s) => ({ ...s, [p]: Number(e.target.value) || 0 }))}
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums"
                />
                <span className="text-xs text-muted-foreground">%</span>
                <button
                  type="button"
                  onClick={() => save(p)}
                  disabled={pendingPlatform === p}
                  className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-secondary disabled:opacity-50"
                  title="Yadda saxla"
                >
                  <Save className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
