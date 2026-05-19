"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveNot, deleteNot } from "@/features/sahibkar/owner-actions";

type Note = { id: number; basliq: string | null; metn: string | null; reng: string | null; pinned: boolean };

export function NoteDialog({ note }: { note?: Note }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  async function action(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await saveNot(formData);
      if (res.ok) setOpen(false);
      else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {note ? (
          <Button variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button size="sm"><Plus className="h-3.5 w-3.5" /> Yeni qeyd</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{note ? "Qeydi redaktə et" : "Yeni qeyd"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          {note ? <input type="hidden" name="id" value={note.id} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="basliq">Başlıq</Label>
            <Input id="basliq" name="basliq" defaultValue={note?.basliq ?? ""} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="metn">Mətn</Label>
            <textarea id="metn" name="metn" rows={6} maxLength={20000} defaultValue={note?.metn ?? ""} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reng">Rəng</Label>
              <select id="reng" name="reng" defaultValue={note?.reng ?? "sari"} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="sari">Sarı</option>
                <option value="mavi">Mavi</option>
                <option value="yasil">Yaşıl</option>
                <option value="cehrayi">Çəhrayı</option>
                <option value="qirmizi">Qırmızı</option>
                <option value="bənövşəyi">Bənövşəyi</option>
                <option value="boz">Boz</option>
              </select>
            </div>
            <label className="mt-6 inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="pinned" defaultChecked={!!note?.pinned} /> Pin et
            </label>
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

export function DeleteNoteButton({ id }: { id: number }) {
  const [isPending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        if (!confirm("Qeyd silinsin?")) return;
        start(async () => {
          fd.set("id", String(id));
          await deleteNot(fd);
        });
      }}
    >
      <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
        <Trash2 className="h-3.5 w-3.5 text-danger" />
      </Button>
    </form>
  );
}
