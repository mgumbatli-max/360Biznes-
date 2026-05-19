"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFilial } from "@/features/sahibkar/owner-actions";

type Filial = {
  id: number;
  ad: string;
  unvan: string | null;
  telefon: string | null;
  seh_r: string | null;
  tip: string | null;
};

export function BranchDialog({ filial }: { filial?: Filial }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  async function action(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await saveFilial(formData);
      if (res.ok) setOpen(false);
      else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {filial ? (
          <Button variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button size="sm"><Plus className="h-3.5 w-3.5" /> Yeni filial</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{filial ? "Filialı redaktə et" : "Yeni filial"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          {filial ? <input type="hidden" name="id" value={filial.id} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="ad">Ad</Label>
            <Input id="ad" name="ad" defaultValue={filial?.ad ?? ""} required maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="seh_r">Şəhər</Label>
              <Input id="seh_r" name="seh_r" defaultValue={filial?.seh_r ?? ""} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefon">Telefon</Label>
              <Input id="telefon" name="telefon" defaultValue={filial?.telefon ?? ""} maxLength={20} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unvan">Ünvan</Label>
            <Input id="unvan" name="unvan" defaultValue={filial?.unvan ?? ""} maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tip">Tip</Label>
            <select id="tip" name="tip" defaultValue={filial?.tip ?? "magaza"} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="magaza">Mağaza</option>
              <option value="anbar">Anbar</option>
              <option value="ofis">Ofis</option>
              <option value="servis">Servis</option>
            </select>
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Ləğv et</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Yadda saxlanır…" : "Yadda saxla"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
