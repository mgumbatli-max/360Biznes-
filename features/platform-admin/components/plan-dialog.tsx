"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePlan, deletePlan } from "@/features/platform-admin/actions";

type Plan = {
  id: number;
  kod: string;
  ad: string;
  ayl_q_qiymet: number;
  illik_qiymet: number | null;
  max_istifadeci: number | null;
  max_mehsul: number | null;
  max_mesaj_ayl_q: number | null;
  storage_mb: number | null;
  aktiv: boolean;
};

export function PlanDialog({ plan }: { plan?: Plan }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function action(formData: FormData) {
    setErr(null);
    start(async () => {
      const r = await savePlan(formData);
      if (r.ok) {
        toast.success(plan ? "Plan yeniləndi" : "Plan yaradıldı");
        setOpen(false);
      } else setErr(r.error);
    });
  }

  function onDelete() {
    if (!plan) return;
    if (!confirm(`"${plan.ad}" planı silinsin?`)) return;
    start(async () => {
      const r = await deletePlan(plan.id);
      if (r.ok) {
        toast.success("Silindi");
        setOpen(false);
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {plan ? (
          <Button variant="outline" size="sm" className="h-7"><Pencil className="h-3.5 w-3.5" /> Redaktə</Button>
        ) : (
          <Button size="sm"><Plus className="h-3.5 w-3.5" /> Yeni plan</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Plan: ${plan.ad}` : "Yeni plan"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kod">Kod</Label>
              <Input id="kod" name="kod" defaultValue={plan?.kod ?? ""} required maxLength={30} pattern="[a-zA-Z0-9_-]+" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad">Ad</Label>
              <Input id="ad" name="ad" defaultValue={plan?.ad ?? ""} required maxLength={80} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ayl_q_qiymet">Aylıq qiymət (AZN)</Label>
              <Input id="ayl_q_qiymet" name="ayl_q_qiymet" type="number" step="0.01" defaultValue={plan?.ayl_q_qiymet ?? 0} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="illik_qiymet">İllik qiymət (AZN)</Label>
              <Input id="illik_qiymet" name="illik_qiymet" type="number" step="0.01" defaultValue={plan?.illik_qiymet ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="max_istifadeci">Maks. istifadəçi</Label>
              <Input id="max_istifadeci" name="max_istifadeci" type="number" defaultValue={plan?.max_istifadeci ?? ""} placeholder="boş = limitsiz" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max_mehsul">Maks. məhsul</Label>
              <Input id="max_mehsul" name="max_mehsul" type="number" defaultValue={plan?.max_mehsul ?? ""} placeholder="boş = limitsiz" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="max_mesaj_ayl_q">Maks. mesaj/ay</Label>
              <Input id="max_mesaj_ayl_q" name="max_mesaj_ayl_q" type="number" defaultValue={plan?.max_mesaj_ayl_q ?? ""} placeholder="boş = limitsiz" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="storage_mb">Storage (MB)</Label>
              <Input id="storage_mb" name="storage_mb" type="number" defaultValue={plan?.storage_mb ?? ""} placeholder="boş = limitsiz" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="aktiv" defaultChecked={plan ? plan.aktiv !== false : true} className="h-4 w-4" />
            Aktiv
          </label>
          {err ? <p className="text-xs text-danger">{err}</p> : null}
          <DialogFooter className="gap-2">
            {plan ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={onDelete} className="mr-auto text-danger hover:bg-danger/10">
                <Trash2 className="h-3.5 w-3.5" /> Sil
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Ləğv et</Button>
            <Button type="submit" disabled={pending}>{pending ? "Yadda saxlanır…" : "Yadda saxla"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
