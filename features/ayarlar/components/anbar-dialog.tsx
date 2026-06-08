"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveWarehouse } from "@/features/ayarlar/anbar-actions";

type Filial = { id: number; ad: string };
type Mesul = { id: string; ad_soyad: string };
type Anbar = {
  id: number;
  ad: string;
  unvan: string | null;
  filial_id: number | null;
  mesul_id: string | null;
  aktiv: boolean | null;
  nov?: string | null;
  aciqlamaq?: string | null;
};

const NOV_OPTIONS = [
  { value: "standart", label: "Standart anbar", desc: "Satışa hazır mal", icon: "📦" },
  { value: "defekt", label: "Defekt / yararsız", desc: "Zədə, son istifadə vaxtı keçmiş", icon: "⚠️" },
  { value: "karantın", label: "Karantın / izolyasiya", desc: "Yoxlamadan keçməyən mal", icon: "🔒" },
];

export function AnbarDialog({ filiallar, mesullar, anbar }: { filiallar: Filial[]; mesullar: Mesul[]; anbar?: Anbar }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function action(formData: FormData) {
    setErr(null);
    start(async () => {
      const r = await saveWarehouse(formData);
      if (r.ok) setOpen(false);
      else setErr(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {anbar ? (
          <Button variant="ghost" size="sm" className="h-7"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button size="sm"><Plus className="h-3.5 w-3.5" /> Yeni anbar</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{anbar ? "Anbarı redaktə et" : "Yeni anbar"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          {anbar ? <input type="hidden" name="id" value={anbar.id} /> : null}

          <div className="space-y-1.5">
            <Label>Anbar növü</Label>
            <div className="grid grid-cols-3 gap-2">
              {NOV_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-border/60 px-2 py-2.5 text-xs font-semibold transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/10 hover:bg-secondary/30"
                >
                  <input
                    type="radio"
                    name="nov"
                    value={opt.value}
                    defaultChecked={(anbar?.nov ?? "standart") === opt.value}
                    className="sr-only"
                  />
                  <span className="text-base">{opt.icon}</span>
                  <span className="text-center">{opt.label}</span>
                  <span className="text-center text-[9.5px] font-normal text-muted-foreground">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ad">Ad</Label>
            <Input id="ad" name="ad" defaultValue={anbar?.ad ?? ""} required maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unvan">Ünvan</Label>
            <Input id="unvan" name="unvan" defaultValue={anbar?.unvan ?? ""} maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aciqlamaq">Açıqlama / qeyd (opsional)</Label>
            <textarea
              id="aciqlamaq"
              name="aciqlamaq"
              rows={2}
              maxLength={500}
              defaultValue={anbar?.aciqlamaq ?? ""}
              placeholder="Hansı növ mal üçündür, hansı şərtlərlə..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="filial_id">Filial</Label>
              <select id="filial_id" name="filial_id" defaultValue={anbar?.filial_id ?? ""} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">—</option>
                {filiallar.map((f) => <option key={f.id} value={f.id}>{f.ad}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mesul_id">Məsul</Label>
              <select id="mesul_id" name="mesul_id" defaultValue={anbar?.mesul_id ?? ""} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">—</option>
                {mesullar.map((m) => <option key={m.id} value={m.id}>{m.ad_soyad}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="aktiv" defaultChecked={anbar ? anbar.aktiv !== false : true} className="h-4 w-4" />
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
