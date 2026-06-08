"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, Loader2, Warehouse, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickCreateWarehouse } from "../quick-create-warehouse";

type Props = {
  defaultName?: string;
  onCreated: (warehouse: { id: number; ad: string }) => void;
  variant?: "icon" | "button";
};

export function QuickCreateWarehouseDialog({ defaultName, onCreated, variant = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ad, setAd] = useState(defaultName ?? "");
  const [unvan, setUnvan] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (ad.trim().length < 2) { setError("Ad ən azı 2 simvol"); return; }
    startTransition(async () => {
      const r = await quickCreateWarehouse({ ad: ad.trim(), unvan: unvan.trim() });
      if (r.ok) {
        toast.success(`Anbar yaradıldı: ${r.warehouse.ad}`);
        onCreated(r.warehouse);
        setOpen(false);
        setAd(""); setUnvan("");
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setAd(defaultName ?? ""); }}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <button
            type="button"
            title="Yeni anbar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-background hover:bg-secondary"
          >
            <Warehouse className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5" /> Yeni anbar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Warehouse className="h-4 w-4" /> Sürətli anbar yarat
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <div className="rounded-md border border-rose-500/40 bg-rose-50 p-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          <div>
            <Label className="text-xs">Ad *</Label>
            <Input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              autoFocus required minLength={2} maxLength={100}
              disabled={pending} className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Ünvan</Label>
            <Input
              value={unvan}
              onChange={(e) => setUnvan(e.target.value)}
              maxLength={500}
              disabled={pending} className="h-9"
            />
          </div>
          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <Link
              href={`/anbar/anbarlar?yeni=1${ad ? `&name=${encodeURIComponent(ad)}` : ""}`}
              target="_blank" rel="noopener"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            >
              Tam formada aç <ExternalLink className="h-2.5 w-2.5" />
            </Link>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                İmtina
              </Button>
              <Button type="submit" disabled={pending || ad.trim().length < 2}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Yarat
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
