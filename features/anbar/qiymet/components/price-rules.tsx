"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Loader2, Sparkles, ArrowRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { applyPriceFormula } from "../actions";

type Field =
  | "alish_qiymeti"
  | "satis_qiymeti"
  | "endirimli_qiymet"
  | "min_satis_qiymeti"
  | "topdan_qiymeti"
  | "partnyor_qiymeti"
  | "vip_qiymeti";

const FIELD_LABELS: Record<Field, string> = {
  alish_qiymeti:     "Maya (Alış)",
  satis_qiymeti:     "Satış",
  endirimli_qiymet:  "Endirimli",
  min_satis_qiymeti: "Min satış",
  topdan_qiymeti:    "Topdan",
  partnyor_qiymeti:  "Partnyor",
  vip_qiymeti:       "VIP",
};

type Preset = {
  id: string;
  name: string;
  desc: string;
  target: Field;
  source: Field;
  multiplier: number;
  only_if_empty: boolean;
};

const PRESETS: Preset[] = [
  {
    id: "satis-marja-25",
    name: "Satış = Maya + 25%",
    desc: "Marja təminatı — heç bir məhsul maya üstü 25%-dən aşağı satılmasın",
    target: "satis_qiymeti",
    source: "alish_qiymeti",
    multiplier: 1.25,
    only_if_empty: true,
  },
  {
    id: "satis-marja-40",
    name: "Satış = Maya × 1.40",
    desc: "40% marja — pərakəndə sənaye standartı",
    target: "satis_qiymeti",
    source: "alish_qiymeti",
    multiplier: 1.4,
    only_if_empty: true,
  },
  {
    id: "topdan-90",
    name: "Topdan = Satış × 0.90",
    desc: "Topdan müştəri 10% endirim alır",
    target: "topdan_qiymeti",
    source: "satis_qiymeti",
    multiplier: 0.9,
    only_if_empty: false,
  },
  {
    id: "vip-85",
    name: "VIP = Satış × 0.85",
    desc: "VIP müştərilərə 15% endirim",
    target: "vip_qiymeti",
    source: "satis_qiymeti",
    multiplier: 0.85,
    only_if_empty: false,
  },
  {
    id: "partnyor-80",
    name: "Partnyor = Satış × 0.80",
    desc: "Partner şirkətlər üçün 20% endirim",
    target: "partnyor_qiymeti",
    source: "satis_qiymeti",
    multiplier: 0.8,
    only_if_empty: false,
  },
  {
    id: "min-maya-1-15",
    name: "Min satış = Maya × 1.15",
    desc: "Heç bir satış maya + 15%-dən aşağı düşməsin",
    target: "min_satis_qiymeti",
    source: "alish_qiymeti",
    multiplier: 1.15,
    only_if_empty: false,
  },
];

export function PriceRulesButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customTarget, setCustomTarget] = useState<Field>("topdan_qiymeti");
  const [customSource, setCustomSource] = useState<Field>("satis_qiymeti");
  const [customMult, setCustomMult] = useState("0.9");
  const [onlyEmpty, setOnlyEmpty] = useState(true);

  function apply(p: Preset) {
    if (
      !window.confirm(
        `"${p.name}" qaydası bütün aktiv məhsullara tətbiq olunsun?\n\n` +
          `${FIELD_LABELS[p.target]} = ${FIELD_LABELS[p.source]} × ${p.multiplier}\n` +
          (p.only_if_empty ? "(yalnız boş olan hədəfə)" : "(bütün hədəflər yenilənir)"),
      )
    )
      return;
    startTransition(async () => {
      const r = await applyPriceFormula({
        target: p.target,
        source: p.source,
        multiplier: p.multiplier,
        only_if_empty: p.only_if_empty,
      });
      if (!r.ok) {
        toast.error(r.error);
      } else {
        toast.success(`${r.count ?? 0} məhsul yeniləndi`);
        setOpen(false);
        router.refresh();
      }
    });
  }

  function applyCustom() {
    const m = Number(customMult);
    if (!Number.isFinite(m) || m <= 0) {
      toast.error("Çarpan müsbət olmalıdır");
      return;
    }
    if (customTarget === customSource) {
      toast.error("Hədəf və mənbə eyni ola bilməz");
      return;
    }
    if (
      !window.confirm(
        `${FIELD_LABELS[customTarget]} = ${FIELD_LABELS[customSource]} × ${m}\n` +
          (onlyEmpty ? "(yalnız boş hədəflərə)" : "(hamısı yenilənir)"),
      )
    )
      return;
    startTransition(async () => {
      const r = await applyPriceFormula({
        target: customTarget,
        source: customSource,
        multiplier: m,
        only_if_empty: onlyEmpty,
      });
      if (!r.ok) {
        toast.error(r.error);
      } else {
        toast.success(`${r.count ?? 0} məhsul yeniləndi`);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Calculator className="h-3.5 w-3.5" /> Qiymət qaydaları
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto p-0">
          <SheetHeader className="sticky top-0 z-10 flex flex-row items-center justify-between gap-2 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
            <SheetTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" /> Qiymət qaydaları
            </SheetTitle>
            <SheetClose />
          </SheetHeader>

          <div className="space-y-5 p-5">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
              <div className="font-semibold text-primary">Qiymət avtomatlaşdırılması</div>
              <div className="mt-1 text-muted-foreground">
                Bir qiymət sahəsini başqasından düstür ilə hesab et. Misal: <strong>Topdan = Satış × 0.9</strong>.
                Maya dəyişdikdə dərhal yenidən tətbiq edə bilərsən.
              </div>
            </div>

            {/* Hazır preset-lər */}
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Hazır qaydalar
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id);
                      apply(p);
                    }}
                    disabled={pending}
                    className={`group flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition disabled:opacity-50 ${
                      selectedId === p.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {p.name}
                      {selectedId === p.id && pending && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </div>
                    <div className="text-[11px] leading-snug text-muted-foreground">{p.desc}</div>
                    <div className="flex items-center gap-1 text-[10.5px] font-mono text-muted-foreground/80">
                      <span>{FIELD_LABELS[p.source]}</span>
                      <span>×</span>
                      <span className="font-semibold text-foreground">{p.multiplier}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{FIELD_LABELS[p.target]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom formula */}
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <h3 className="mb-3 text-sm font-semibold">Öz qaydanı tərtib et</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-end">
                <div>
                  <Label className="text-[10.5px]">Hədəf</Label>
                  <select
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value as Field)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                      <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
                <span className="hidden pb-2 text-muted-foreground sm:inline">=</span>
                <div>
                  <Label className="text-[10.5px]">Mənbə</Label>
                  <select
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value as Field)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                      <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
                <span className="hidden pb-2 text-muted-foreground sm:inline">×</span>
                <div>
                  <Label className="text-[10.5px]">Çarpan</Label>
                  <Input
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={customMult}
                    onChange={(e) => setCustomMult(e.target.value)}
                    className="mt-1 h-9"
                  />
                </div>
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={onlyEmpty}
                  onChange={(e) => setOnlyEmpty(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                Yalnız boş hədəflərə tətbiq et (mövcudları toxunma)
              </label>

              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                  Bağla
                </Button>
                <Button type="button" onClick={applyCustom} disabled={pending}>
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Qaydanı tətbiq et
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
