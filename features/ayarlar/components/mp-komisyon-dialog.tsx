"use client";

import { useState, useTransition } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMarketplaceCommission } from "@/features/ayarlar/mp-komisyon-actions";

type Config = {
  faiz?: number;
  odenis_gun?: number;
  default_edv?: number;
  valyuta?: string;
};

export function MpKomisyonDialog({
  platform,
  label,
  defaultFaiz,
  current,
}: {
  platform: string;
  label: string;
  defaultFaiz: number;
  current?: Config;
}) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onAction(formData: FormData) {
    setErr(null);
    start(async () => {
      const res = await saveMarketplaceCommission(formData);
      if (res.ok) setOpen(false);
      else setErr(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]">
          <Pencil className="h-3 w-3" /> Düzəliş
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label} — komissiya tənzimləri</DialogTitle>
        </DialogHeader>
        <form action={onAction} className="space-y-3">
          <input type="hidden" name="platform" value={platform} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="faiz">Komissiya (%)</Label>
              <Input
                id="faiz"
                name="faiz"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue={current?.faiz ?? defaultFaiz}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="odenis_gun">Ödəniş günü</Label>
              <Input
                id="odenis_gun"
                name="odenis_gun"
                type="number"
                min="0"
                max="31"
                defaultValue={current?.odenis_gun ?? 5}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="default_edv">Default ƏDV (%)</Label>
              <Input
                id="default_edv"
                name="default_edv"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue={current?.default_edv ?? 18}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valyuta">Valyuta</Label>
              <select
                id="valyuta"
                name="valyuta"
                defaultValue={current?.valyuta ?? "AZN"}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="AZN">AZN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
                <option value="RUB">RUB</option>
              </select>
            </div>
          </div>
          {err ? <p className="text-xs text-danger">{err}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Ləğv et
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Yadda saxla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
