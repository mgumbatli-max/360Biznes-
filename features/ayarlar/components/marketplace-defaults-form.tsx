"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { saveMarketplaceDefaults } from "@/features/ticaret/marketplace-defaults";
import type {
  MarketplaceDefaultsMap,
  Platform,
} from "@/features/ticaret/marketplace-platforms";

const PLATFORMS: { value: Platform; label: string; tone: string }[] = [
  { value: "bolt_food", label: "Bolt Food", tone: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700" },
  { value: "wolt", label: "Wolt", tone: "bg-sky-500/10 border-sky-500/30 text-sky-700" },
  { value: "yango_deli", label: "Yango Deli", tone: "bg-rose-500/10 border-rose-500/30 text-rose-700" },
  { value: "tap_az", label: "Tap.az", tone: "bg-amber-500/10 border-amber-500/30 text-amber-700" },
  { value: "progo", label: "ProGo", tone: "bg-violet-500/10 border-violet-500/30 text-violet-700" },
  { value: "birmarket", label: "Birmarket", tone: "bg-cyan-500/10 border-cyan-500/30 text-cyan-700" },
  { value: "umico", label: "Umico", tone: "bg-pink-500/10 border-pink-500/30 text-pink-700" },
  { value: "amazon", label: "Amazon", tone: "bg-orange-500/10 border-orange-500/30 text-orange-700" },
  { value: "noon", label: "Noon", tone: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700" },
  { value: "diger", label: "Digər", tone: "bg-slate-500/10 border-slate-500/30 text-slate-700" },
];

type HesabOpt = { id: string; ad: string };
type AnbarOpt = { id: number; ad: string };

type State = Record<
  Platform,
  {
    komissiya_faiz: number;
    hesab_id: string;
    anbar_id: string;
  }
>;

function initialState(map: MarketplaceDefaultsMap): State {
  const state: Partial<State> = {};
  for (const p of PLATFORMS) {
    const cur = map[p.value];
    state[p.value] = {
      komissiya_faiz: cur?.komissiya_faiz ?? 0,
      hesab_id: cur?.hesab_id ?? "",
      anbar_id: cur?.anbar_id != null ? String(cur.anbar_id) : "",
    };
  }
  return state as State;
}

export function MarketplaceDefaultsForm({
  initial,
  hesablar,
  anbarlar,
}: {
  initial: MarketplaceDefaultsMap;
  hesablar: HesabOpt[];
  anbarlar: AnbarOpt[];
}) {
  const [state, setState] = useState<State>(initialState(initial));
  const [savingPlatform, setSavingPlatform] = useState<Platform | null>(null);
  const [pending, startTransition] = useTransition();

  function update(p: Platform, patch: Partial<State[Platform]>) {
    setState((prev) => ({ ...prev, [p]: { ...prev[p], ...patch } }));
  }

  function save(p: Platform) {
    const cur = state[p];
    setSavingPlatform(p);
    startTransition(async () => {
      const r = await saveMarketplaceDefaults({
        platform: p,
        komissiya_faiz: cur.komissiya_faiz,
        hesab_id: cur.hesab_id || null,
        anbar_id: cur.anbar_id ? Number(cur.anbar_id) : null,
      });
      setSavingPlatform(null);
      if (!r.ok) {
        toast.error(r.error);
      } else {
        toast.success(`${PLATFORMS.find((x) => x.value === p)?.label} ayarları yadda saxlandı`);
      }
    });
  }

  const hesabOptions: ComboOption[] = [
    { value: "", label: "— Seçilməyib —" },
    ...hesablar.map((h) => ({ value: h.id, label: h.ad })),
  ];
  const anbarOptions: ComboOption[] = [
    { value: "", label: "— Seçilməyib —" },
    ...anbarlar.map((a) => ({ value: String(a.id), label: a.ad })),
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
        💡 <strong>Necə işləyir:</strong> Marketplace satış formada platforma seçildikdə, burada təyin etdiyiniz komissiya, bank hesabı və anbar avtomatik gəlir. İstifadəçi əl ilə dəyişə bilər. Boş sahələr default tətbiq olunmur.
      </div>

      <div className="grid grid-cols-1 gap-2">
        {PLATFORMS.map((p) => {
          const cur = state[p.value];
          const isSaving = savingPlatform === p.value && pending;
          return (
            <Card key={p.value} className={`border ${p.tone}`}>
              <CardContent className="p-3">
                <div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))_auto] items-end gap-3">
                  <div>
                    <div className="text-base font-semibold">{p.label}</div>
                    <div className="text-[10.5px] opacity-70">Default ayarlar</div>
                  </div>
                  <div>
                    <Lbl>Komissiya %</Lbl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={cur.komissiya_faiz}
                      onChange={(e) =>
                        update(p.value, {
                          komissiya_faiz: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        })
                      }
                      className="h-8 text-right text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <Lbl>Default hesab</Lbl>
                    <Combobox
                      options={hesabOptions}
                      value={cur.hesab_id}
                      onChange={(v) => update(p.value, { hesab_id: v })}
                      placeholder="— seç —"
                    />
                  </div>
                  <div>
                    <Lbl>Default anbar</Lbl>
                    <Combobox
                      options={anbarOptions}
                      value={cur.anbar_id}
                      onChange={(v) => update(p.value, { anbar_id: v })}
                      placeholder="— seç —"
                    />
                  </div>
                  <Button
                    onClick={() => save(p.value)}
                    disabled={isSaving}
                    className="h-8"
                    size="sm"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Saxla
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}
