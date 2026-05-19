"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMaasBand, deleteMaasBand } from "../maas-band-actions";
import { formatMoney } from "@/lib/utils";
import type { MaasBand } from "../maas-band-queries";

export function MaasBandPanel({ initial }: { initial: MaasBand[] }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <NewBandDialog />
      </div>
      <Card className="glass">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Vəzifə</th>
                  <th className="px-3 py-2.5">İşçi sayı</th>
                  <th className="px-3 py-2.5 text-right">Min</th>
                  <th className="px-3 py-2.5 text-right">Ortalama</th>
                  <th className="px-3 py-2.5 text-right">Max</th>
                  <th className="px-3 py-2.5 text-right">Cari orta</th>
                  <th className="px-3 py-2.5">Vəziyyət</th>
                  <th className="px-3 py-2.5 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {initial.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      Hələ vəzifə aralığı yoxdur. &quot;Yeni aralıq&quot; düyməsi ilə əlavə edin.
                    </td>
                  </tr>
                ) : (
                  initial.map((b) => {
                    const has = b.max > 0;
                    const cur = b.current_avg ?? 0;
                    const tone = !has
                      ? "border-border text-muted-foreground"
                      : cur < b.min
                      ? "border-warning/30 text-warning"
                      : cur > b.max
                      ? "border-danger/30 text-danger"
                      : "border-success/30 text-success";
                    const label = !has
                      ? "Tənzimlənməyib"
                      : cur < b.min
                      ? "Aşağı"
                      : cur > b.max
                      ? "Yuxarı"
                      : "Aralıqda";
                    return (
                      <tr key={b.vezife} className="border-b border-border/30">
                        <td className="px-3 py-2.5 font-medium">{b.vezife}</td>
                        <td className="px-3 py-2.5 tabular-nums">{b.count ?? 0}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{has ? formatMoney(b.min) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{has ? formatMoney(b.ortalama) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{has ? formatMoney(b.max) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{cur ? formatMoney(cur) : "—"}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={`text-[10px] ${tone}`}>{label}</Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <BandActions band={b} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BandActions({ band }: { band: MaasBand }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function onDelete() {
    if (!confirm(`${band.vezife} aralığı silinsin?`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("vezife", band.vezife);
      const res = await deleteMaasBand(fd);
      if (res.ok) toast.success("Silindi");
      else toast.error(res.error);
      router.refresh();
    });
  }
  return (
    <div className="flex items-center gap-1">
      <EditBandDialog band={band} />
      {band.max > 0 && (
        <Button size="sm" variant="ghost" onClick={onDelete} disabled={pending} className="text-danger">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function NewBandDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveMaasBand(fd);
      if (res.ok) {
        toast.success("Yadda saxlanıldı");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni aralıq
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader><DialogTitle>Maaş aralığı</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vezife">Vəzifə *</Label>
            <Input id="vezife" name="vezife" required maxLength={100} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="min">Min</Label>
              <Input id="min" name="min" type="number" min="0" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ortalama">Ortalama</Label>
              <Input id="ortalama" name="ortalama" type="number" min="0" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Max</Label>
              <Input id="max" name="max" type="number" min="0" step="0.01" required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yadda saxla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditBandDialog({ band }: { band: MaasBand }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("vezife", band.vezife);
    startTransition(async () => {
      const res = await saveMaasBand(fd);
      if (res.ok) {
        toast.success("Yenilənildi");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader><DialogTitle>{band.vezife} — aralıq</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="min">Min</Label>
              <Input id="min" name="min" type="number" min="0" step="0.01" required defaultValue={band.min} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ortalama">Ortalama</Label>
              <Input id="ortalama" name="ortalama" type="number" min="0" step="0.01" required defaultValue={band.ortalama} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Max</Label>
              <Input id="max" name="max" type="number" min="0" step="0.01" required defaultValue={band.max} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yadda saxla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
