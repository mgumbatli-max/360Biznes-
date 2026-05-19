"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePartiya } from "@/features/sahibkar/owner-actions";

export function PartiyaDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  async function action(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await savePartiya(formData);
      if (res.ok) setOpen(false);
      else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5" /> Yeni partiya</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni partiya</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ad">Partiya adı</Label>
            <Input id="ad" name="ad" required maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="olke">Ölkə</Label>
              <Input id="olke" name="olke" maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valyuta">Valyuta</Label>
              <select id="valyuta" name="valyuta" defaultValue="USD" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AZN">AZN</option>
                <option value="TRY">TRY</option>
                <option value="RUB">RUB</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select id="status" name="status" defaultValue="qaralama" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="qaralama">Qaralama</option>
              <option value="aktiv">Aktiv</option>
              <option value="tamam">Tamamlandı</option>
            </select>
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Ləğv et</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Yadda saxlanır…" : "Yarat"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
