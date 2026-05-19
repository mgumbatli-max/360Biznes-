"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { BonusProfil, BonusPaylanma, BonusKategoriya } from "@/features/iscilier/bonus-profile";
import { saveBonusProfil } from "@/features/iscilier/bonus-profile-actions";

const KATEQ_LABEL: Record<BonusKategoriya, string> = {
  davamiyyet: "Davamiyyət",
  tapsiriq: "Tapşırıqlar vaxtında",
  sehv_yoxlugu: "Səhvsiz proseslər",
  borc_yigim: "Borc yığımı",
  satis_hedef: "Satış hədəfi",
};

const HEDEF_VAHID: Record<BonusKategoriya, "faiz" | "mebleg"> = {
  davamiyyet: "faiz",
  tapsiriq: "faiz",
  sehv_yoxlugu: "faiz",
  borc_yigim: "faiz",
  satis_hedef: "mebleg",
};

const ALL_KATEQ: BonusKategoriya[] = ["davamiyyet", "tapsiriq", "sehv_yoxlugu", "borc_yigim", "satis_hedef"];

export function BonusProfileCard({
  istifadeciId,
  initial,
}: {
  istifadeciId: string;
  initial: BonusProfil;
}) {
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
        toast.success("Bonus profili yadda saxlandı");
      } else {
        toast.error(res.error);
      }
    });
  }

  // Pool hesabla — preview üçün
  const poolPreview =
    profile.metod === "fixed"
      ? profile.fixed_mebleg
      : profile.metod === "percent_satis"
        ? `Aylıq satışın ${profile.percent}%-i`
        : `Aylıq mənfəətin ${profile.percent}%-i`;

  // Paylanma yoxla — cəm
  const fixedSum = profile.paylanma
    .filter((p) => p.tip === "mebleg")
    .reduce((s, p) => s + p.deyer, 0);
  const percentSum = profile.paylanma
    .filter((p) => p.tip === "faiz")
    .reduce((s, p) => s + p.deyer, 0);
  const usedSlots = new Set(profile.paylanma.map((p) => p.kateqoriya));

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" />
          Bonus profili
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Əməkdaşın bonusunu kateqoriyalara böl. Hər kateqoriyada hədəfə nail olunmasa,
          o hissə proporsional azalır.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metod */}
        <div>
          <Label className="text-xs">Bonus pool metodu</Label>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {([
              { v: "fixed", label: "Sabit məbləğ", desc: "₼ standart" },
              { v: "percent_satis", label: "Satışdan %", desc: "Dövriyyə" },
              { v: "percent_menfaat", label: "Mənfəətdən %", desc: "Maya-satış fərqi" },
            ] as const).map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setProfile((p) => ({ ...p, metod: m.v }))}
                className={`rounded-md border px-2 py-2 text-center transition ${
                  profile.metod === m.v
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-secondary/30"
                }`}
              >
                <div className="text-[11px] font-bold">{m.label}</div>
                <div className="text-[9.5px] text-muted-foreground">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Pool məbləğ konfiqurasiyası */}
        {profile.metod === "fixed" ? (
          <div>
            <Label className="text-xs">Sabit bonus məbləği</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                value={profile.fixed_mebleg}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, fixed_mebleg: Number(e.target.value || 0) }))
                }
                min={0}
                max={1000000}
                className="h-9 w-40 rounded-md border border-input bg-background px-3 text-right text-sm font-bold tabular-nums"
              />
              <span className="text-sm font-bold text-muted-foreground">₼</span>
              <span className="text-[10.5px] text-muted-foreground">aylıq</span>
            </div>
          </div>
        ) : (
          <div>
            <Label className="text-xs">Faiz</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                value={profile.percent}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, percent: Number(e.target.value || 0) }))
                }
                min={0}
                max={100}
                step={0.5}
                className="h-9 w-24 rounded-md border border-input bg-background px-3 text-right text-sm font-bold tabular-nums"
              />
              <span className="text-sm font-bold text-muted-foreground">%</span>
              <span className="text-[10.5px] text-muted-foreground">
                {profile.metod === "percent_satis" ? "satışdan" : "mənfəətdən"}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <strong>Bonus pool:</strong>{" "}
          <span className="font-bold text-primary tabular-nums">
            {typeof poolPreview === "number" ? `${poolPreview} ₼` : poolPreview}
          </span>
        </div>

        {/* Paylanma cədvəli */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs">Bonusu kateqoriyalara böl</Label>
            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={usedSlots.size >= ALL_KATEQ.length}>
              <Plus className="h-3 w-3" />
              Kateqoriya
            </Button>
          </div>

          {profile.paylanma.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Hələ heç bir kateqoriya yoxdur. "+ Kateqoriya" düyməsi ilə əlavə et.
            </div>
          ) : (
            <div className="space-y-1.5">
              {profile.paylanma.map((row, idx) => {
                const hedefVahidLbl = HEDEF_VAHID[row.kateqoriya] === "faiz" ? "%" : "₼";
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-1.5 rounded-md border border-border/40 bg-card/40 px-2 py-1.5"
                  >
                    {/* Kateqoriya */}
                    <select
                      value={row.kateqoriya}
                      onChange={(e) => {
                        const nextK = e.target.value as BonusKategoriya;
                        updateRow(idx, {
                          kateqoriya: nextK,
                          hedef: HEDEF_VAHID[nextK] === "faiz" ? 90 : 0,
                        });
                      }}
                      className="col-span-4 h-8 rounded border border-input bg-background px-2 text-xs"
                    >
                      {ALL_KATEQ.map((k) => (
                        <option key={k} value={k} disabled={usedSlots.has(k) && k !== row.kateqoriya}>
                          {KATEQ_LABEL[k]}
                        </option>
                      ))}
                    </select>

                    {/* Tip */}
                    <select
                      value={row.tip}
                      onChange={(e) => updateRow(idx, { tip: e.target.value as "mebleg" | "faiz" })}
                      className="col-span-2 h-8 rounded border border-input bg-background px-2 text-xs"
                    >
                      <option value="mebleg">₼ məbləğ</option>
                      <option value="faiz">% pool-dan</option>
                    </select>

                    {/* Dəyər */}
                    <div className="col-span-2 flex items-center gap-0.5">
                      <input
                        type="number"
                        value={row.deyer}
                        onChange={(e) => updateRow(idx, { deyer: Number(e.target.value || 0) })}
                        min={0}
                        max={1000000}
                        className="h-8 w-full rounded border border-input bg-background px-1.5 text-right text-xs tabular-nums"
                      />
                      <span className="text-[10px] text-muted-foreground">{row.tip === "mebleg" ? "₼" : "%"}</span>
                    </div>

                    {/* Hədəf */}
                    <div className="col-span-3 flex items-center gap-0.5">
                      <span className="text-[10px] text-muted-foreground">hədəf:</span>
                      <input
                        type="number"
                        value={row.hedef}
                        onChange={(e) => updateRow(idx, { hedef: Number(e.target.value || 0) })}
                        min={0}
                        max={1000000}
                        className="h-8 w-full rounded border border-input bg-background px-1.5 text-right text-xs tabular-nums"
                      />
                      <span className="text-[10px] text-muted-foreground">{hedefVahidLbl}</span>
                    </div>

                    {/* Sil */}
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="col-span-1 inline-flex items-center justify-center text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cəm */}
          {profile.paylanma.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-[10.5px] text-muted-foreground">
              {fixedSum > 0 && (
                <Badge variant="outline">Sabit cəmi: <span className="ml-1 font-bold tabular-nums">{fixedSum} ₼</span></Badge>
              )}
              {percentSum > 0 && (
                <Badge variant="outline" className={percentSum > 100 ? "border-rose-500/40 text-rose-500" : ""}>
                  Faiz cəmi: <span className="ml-1 font-bold tabular-nums">{percentSum}%</span>
                  {percentSum > 100 && " (100-dən çox!)"}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/40 pt-3">
          <Button onClick={onSave} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Yadda saxla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
