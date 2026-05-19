"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveExpenseCategory } from "@/features/ayarlar/xerc-kateqoriya-actions";

type Row = {
  id: number;
  ad: string;
  qrup: string | null;
  ikon: string | null;
  reng: string | null;
  aktiv: boolean | null;
};

const GROUPS = ["ümumi", "kira", "kommunal", "marketinq", "logistika", "əmək", "ofis", "vergi", "digər"];

export function XercKateqoriyaDialog({ row, groups }: { row?: Row; groups?: string[] }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const list = groups && groups.length > 0 ? Array.from(new Set([...groups, ...GROUPS])) : GROUPS;

  function action(formData: FormData) {
    setErr(null);
    start(async () => {
      const r = await saveExpenseCategory(formData);
      if (r.ok) setOpen(false);
      else setErr(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {row ? (
          <Button variant="ghost" size="sm" className="h-7"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button size="sm"><Plus className="h-3.5 w-3.5" /> Yeni kateqoriya</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? "Kateqoriyanı redaktə et" : "Yeni xərc kateqoriyası"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          {row ? <input type="hidden" name="id" value={row.id} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="ad">Ad</Label>
            <Input id="ad" name="ad" defaultValue={row?.ad ?? ""} required maxLength={100} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qrup">Üst qrup</Label>
              <select id="qrup" name="qrup" defaultValue={row?.qrup ?? ""} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">—</option>
                {list.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ikon">İkon (emoji)</Label>
              <Input id="ikon" name="ikon" defaultValue={row?.ikon ?? ""} maxLength={50} placeholder="💸" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reng">Rəng</Label>
              <Input id="reng" name="reng" type="color" defaultValue={row?.reng ?? "#64748b"} className="h-9 p-0.5" />
            </div>
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
