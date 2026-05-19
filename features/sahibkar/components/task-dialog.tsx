"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTapshiriq, updateTaskStatus } from "@/features/sahibkar/owner-actions";

type Staff = { id: string; ad_soyad: string };
type Task = {
  id: number;
  basliq: string;
  tesvir: string | null;
  tarix: Date | string | null;
  prioritet: string | null;
  status: string | null;
  istifadeci_id?: string | null;
};

export function TaskDialog({ task, staff }: { task?: Task; staff: Staff[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const dateVal = task?.tarix instanceof Date ? task.tarix.toISOString().slice(0, 10) : (typeof task?.tarix === "string" ? task.tarix.slice(0, 10) : "");

  async function action(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await saveTapshiriq(formData);
      if (res.ok) setOpen(false);
      else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {task ? (
          <Button variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button size="sm"><Plus className="h-3.5 w-3.5" /> Yeni tapşırıq</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Tapşırıq redaktə" : "Yeni tapşırıq"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          {task ? <input type="hidden" name="id" value={task.id} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="basliq">Başlıq</Label>
            <Input id="basliq" name="basliq" defaultValue={task?.basliq ?? ""} required maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tesvir">Təsvir</Label>
            <textarea id="tesvir" name="tesvir" rows={3} defaultValue={task?.tesvir ?? ""} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tarix">Bitiş tarixi</Label>
              <Input id="tarix" name="tarix" type="date" defaultValue={dateVal} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prioritet">Prioritet</Label>
              <select id="prioritet" name="prioritet" defaultValue={task?.prioritet ?? "orta"} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="asagi">Aşağı</option>
                <option value="orta">Orta</option>
                <option value="yuksek">Yüksək</option>
                <option value="kritik">Kritik</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue={task?.status ?? "acig"} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="acig">Açıq</option>
                <option value="isleyir">İşləyir</option>
                <option value="yoxlama">Yoxlama</option>
                <option value="tamam">Tamamlandı</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="istifadeci_id">Məsul</Label>
              <select id="istifadeci_id" name="istifadeci_id" defaultValue={task?.istifadeci_id ?? ""} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">— Heç kim —</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.ad_soyad}</option>)}
              </select>
            </div>
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

export function TaskStatusSelect({ id, status }: { id: number; status: string | null }) {
  const [isPending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        start(async () => {
          fd.set("id", String(id));
          await updateTaskStatus(fd);
        });
      }}
    >
      <select
        name="status"
        defaultValue={status ?? "acig"}
        disabled={isPending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
      >
        <option value="acig">Açıq</option>
        <option value="isleyir">İşləyir</option>
        <option value="yoxlama">Yoxlama</option>
        <option value="tamam">Tamamlandı</option>
      </select>
    </form>
  );
}
