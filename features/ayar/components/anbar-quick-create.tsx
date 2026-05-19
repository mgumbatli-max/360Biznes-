"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Boxes, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createFilialAnbar, updateFilialAnbar, deleteFilialAnbar } from "../actions";

export function AnbarQuickCreate({ filialId }: { filialId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("filial_id", String(filialId));
    startTransition(async () => {
      const res = await createFilialAnbar(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Anbar yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
        >
          <Plus className="h-3 w-3" /> Anbar
        </button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" /> Yeni anbar (bu filiala bağlı)
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="anbar_ad">Anbar adı *</Label>
            <Input id="anbar_ad" name="ad" required minLength={2} maxLength={100} autoFocus disabled={pending} placeholder="Əsas anbar" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="anbar_unvan">Ünvan</Label>
            <Input id="anbar_unvan" name="unvan" maxLength={500} disabled={pending} placeholder="Anbar yeri (opsional)" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AnbarEditDelete({
  anbar,
}: {
  anbar: { id: number; ad: string; unvan: string | null; aktiv: boolean | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletePending, setDeletePending] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", String(anbar.id));
    startTransition(async () => {
      const res = await updateFilialAnbar(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Anbar yeniləndi");
        setOpen(false);
        router.refresh();
      }
    });
  }

  async function onDelete() {
    if (!confirm(`«${anbar.ad}» anbarını silməyi təsdiq edin?\n\nStok hərəkəti varsa anbar deaktiv olunur (qoruyucu).`)) return;
    setDeletePending(true);
    const fd = new FormData();
    fd.set("id", String(anbar.id));
    const res = await deleteFilialAnbar(fd);
    setDeletePending(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
    } else {
      toast.success("Anbar silindi (və ya deaktiv olundu)");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Anbarı redaktə et"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" /> Anbar: {anbar.ad}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ae_ad">Anbar adı *</Label>
            <Input id="ae_ad" name="ad" required minLength={2} maxLength={100} defaultValue={anbar.ad} autoFocus disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ae_unvan">Ünvan</Label>
            <Input id="ae_unvan" name="unvan" maxLength={500} defaultValue={anbar.unvan ?? ""} disabled={pending} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="aktiv"
              value="true"
              defaultChecked={anbar.aktiv ?? true}
              className="h-4 w-4 accent-primary"
              disabled={pending}
            />
            Anbar aktivdir
          </label>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              disabled={pending || deletePending}
              className="mr-auto text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
            >
              {deletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Sil
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yenilə
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
