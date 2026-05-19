"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Sparkles, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { savePriceType } from "@/features/ayarlar/qiymet-tipi-actions";
import {
  computeFormulaPrice,
  FORMULA_NOV_OPTIONS,
  FORMULA_BAZA_OPTIONS,
  YUVARLAMA_OPTIONS,
} from "@/features/ayarlar/qiymet-formula";
import { cn } from "@/lib/utils";

type Row = {
  id: number;
  kod: string;
  ad: string;
  tip: string | null;
  default_marja: string | number | null;
  min_marja: string | number | null;
  aktiv: boolean | null;
  formula_novu?: string | null;
  formula_baza?: string | null;
  formula_faiz?: string | number | null;
  yuvarla?: string | number | null;
  tesvir?: string | null;
};

export function QiymetTipiDialog({ row }: { row?: Row }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [formulaNovu, setFormulaNovu] = useState(row?.formula_novu ?? "yox");
  const [formulaBaza, setFormulaBaza] = useState(row?.formula_baza ?? "maya");
  const [formulaFaiz, setFormulaFaiz] = useState(row?.formula_faiz ? String(row.formula_faiz) : "");
  const [yuvarla, setYuvarla] = useState(row?.yuvarla ? String(row.yuvarla) : "0");

  function action(formData: FormData) {
    setErr(null);
    formData.set("formula_novu", formulaNovu);
    formData.set("formula_baza", formulaBaza);
    formData.set("formula_faiz", formulaFaiz);
    formData.set("yuvarla", yuvarla);
    start(async () => {
      const r = await savePriceType(formData);
      if (r.ok) setOpen(false);
      else setErr(r.error);
    });
  }

  // Preview calculation
  const sampleMaya = 100;
  const sampleSatis = 150;
  const sampleTopdan = 110;
  const preview = computeFormulaPrice(
    formulaNovu,
    formulaBaza,
    Number(formulaFaiz) || 0,
    Number(yuvarla) || 0,
    { maya: sampleMaya, satis: sampleSatis, topdan: sampleTopdan }
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {row ? (
          <Button variant="ghost" size="sm" className="h-7"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button size="sm"><Plus className="h-3.5 w-3.5" /> Yeni qiymət tipi</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto md:max-w-xl">
        <DialogHeader>
          <DialogTitle>{row ? "Qiymət tipini redaktə et" : "Yeni qiymət tipi"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {row ? <input type="hidden" name="id" value={row.id} /> : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kod">Kod</Label>
              <Input id="kod" name="kod" defaultValue={row?.kod ?? ""} required maxLength={40} pattern="[a-zA-Z0-9_]+" placeholder="məs: vip" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad">Ad</Label>
              <Input id="ad" name="ad" defaultValue={row?.ad ?? ""} required maxLength={100} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tip">Tip qrupu</Label>
            <select id="tip" name="tip" defaultValue={row?.tip ?? "standart"} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="standart">Standart</option>
              <option value="topdan">Topdan</option>
              <option value="vip">VIP</option>
              <option value="partner">Partnyor</option>
              <option value="endirim">Endirim</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="default_marja">Default marja (%)</Label>
              <Input id="default_marja" name="default_marja" type="number" step="0.1" defaultValue={row?.default_marja ? String(row.default_marja) : ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min_marja">Min marja (%)</Label>
              <Input id="min_marja" name="min_marja" type="number" step="0.1" defaultValue={row?.min_marja ? String(row.min_marja) : ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tesvir">Təsvir</Label>
            <Input id="tesvir" name="tesvir" defaultValue={row?.tesvir ?? ""} maxLength={300} placeholder="Bu qiymət tipi nə üçündür?" />
          </div>

          {/* === FORMULA === */}
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Avto qiymət formulası</span>
              <Badge variant="outline" className="text-[9px]">Opsional</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Məhsul yaradılan zaman bu qiymət avto-hesablanır. Boş = manual qiymət lazım.
            </p>

            <div className="space-y-1.5">
              <Label className="text-[11px]">Formula növü</Label>
              <div className="space-y-1">
                {FORMULA_NOV_OPTIONS.map((o) => {
                  const active = formulaNovu === o.value;
                  return (
                    <button
                      type="button"
                      key={o.value}
                      onClick={() => setFormulaNovu(o.value)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition",
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border/40 hover:border-border hover:bg-secondary/40"
                      )}
                    >
                      <div className={cn("mt-0.5 h-3 w-3 shrink-0 rounded-full border-2", active ? "border-primary bg-primary" : "border-muted-foreground")} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold">{o.label}</div>
                        <div className="text-[10.5px] text-muted-foreground">{o.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {formulaNovu !== "yox" && formulaNovu !== "fix" && (
              <div className="space-y-1.5">
                <Label className="text-[11px]">Baza qiymət</Label>
                <select
                  value={formulaBaza}
                  onChange={(e) => setFormulaBaza(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {FORMULA_BAZA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {formulaNovu !== "yox" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="faiz" className="text-[11px]">
                    {formulaNovu === "fix" ? "Sabit qiymət (₼)" : "Faiz (%)"}
                  </Label>
                  <Input
                    id="faiz"
                    type="number"
                    step="0.001"
                    value={formulaFaiz}
                    onChange={(e) => setFormulaFaiz(e.target.value)}
                    placeholder={formulaNovu === "fix" ? "100.00" : "30"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="yuvarla" className="text-[11px]">Yuvarlama</Label>
                  <select
                    id="yuvarla"
                    value={yuvarla}
                    onChange={(e) => setYuvarla(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {YUVARLAMA_OPTIONS.map((o) => (
                      <option key={o.value} value={String(o.value)}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {formulaNovu !== "yox" && formulaFaiz && (
              <div className="rounded-md bg-card px-3 py-2 text-[11px]">
                <div className="flex items-center gap-1 font-semibold text-emerald-600">
                  <Calculator className="h-3 w-3" /> Önbaxış
                </div>
                <div className="mt-0.5 text-muted-foreground">
                  Nümunə: maya 100₼, pərakəndə 150₼, topdan 110₼
                </div>
                <div className="mt-1 text-sm font-bold">
                  Nəticə: <span className="text-primary">{preview.value !== null ? preview.value.toFixed(2) + " ₼" : "—"}</span>
                </div>
                <div className="text-[10.5px] text-muted-foreground">{preview.explain}</div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="aktiv" defaultChecked={row ? row.aktiv !== false : true} className="h-4 w-4" />
            Aktiv
          </label>
          {err ? <p className="text-xs text-danger">{err}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Ləğv et</Button>
            <Button type="submit" disabled={pending}>{pending ? "Yadda saxlanır…" : "Yadda saxla"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
