"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { closeKassa } from "../session-actions";
import { formatMoney } from "@/lib/utils";
import type { ActiveKassa } from "../session-queries";

type Props = {
  kassa: ActiveKassa;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function CloseSessionDialog({ kassa, open, onOpenChange }: Props) {
  const [pending, startTransition] = useTransition();
  const expectedCash = kassa.acilis_qaligi + kassa.cari_negd;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await closeKassa(kassa.id, fd);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success("Sessiya bağlandı");
          onOpenChange(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Naməlum xəta";
        console.error("[closeKassa] uncaught", err);
        toast.error(`Sessiya bağlana bilmədi: ${msg}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Kassa sessiyasını bağla</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
            <Row label="Açılış qaliği" value={formatMoney(kassa.acilis_qaligi)} />
            <Row label="Nağd dövriyyəsi" value={formatMoney(kassa.cari_negd)} />
            <div className="my-2 h-px bg-border" />
            <Row label="Gözlənilən qalıq" value={formatMoney(expectedCash)} bold />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hesablanan_qaliq">Faktiki nağd (sayıldı)</Label>
            <Input
              id="hesablanan_qaliq"
              name="hesablanan_qaliq"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={expectedCash}
              disabled={pending}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Kassadakı faktiki nağdı sayın və daxil edin. Fərq varsa qeyd yazın.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd (istəyə bağlı)</Label>
            <textarea
              id="qeyd"
              name="qeyd"
              maxLength={2000}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Bağla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
