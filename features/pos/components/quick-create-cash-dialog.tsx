"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, Loader2, Wallet, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openKassa } from "../session-actions";

/**
 * Sürətli kassa aç — satış/maliyyə formalarından inline yeni kassa sessiyası açır.
 * Mövcud `openKassa` server action-ı çağırır.
 */
type Props = {
  defaultName?: string;
  onCreated: (kassa: { id: string; ad: string }) => void;
  variant?: "icon" | "button";
};

export function QuickCreateCashDialog({ defaultName, onCreated, variant = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ad, setAd] = useState(defaultName ?? "");
  const [acilisQaligi, setAcilisQaligi] = useState("0");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (ad.trim().length < 1) { setError("Ad tələb olunur"); return; }
    startTransition(async () => {
      const r = await openKassa({
        ad: ad.trim(),
        acilis_qaligi: acilisQaligi.trim() ? Number(acilisQaligi) : 0,
      });
      if (r.ok && r.data) {
        toast.success(`Kassa açıldı: ${ad}`);
        onCreated({ id: r.data.id, ad: ad.trim() });
        setOpen(false);
        setAd(""); setAcilisQaligi("0");
      } else if (!r.ok) {
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
            title="Yeni kassa aç"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-background hover:bg-secondary"
          >
            <Wallet className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5" /> Yeni kassa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" /> Sürətli kassa aç
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <div className="rounded-md border border-rose-500/40 bg-rose-50 p-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          <div>
            <Label className="text-xs">Kassa adı *</Label>
            <Input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              autoFocus required minLength={1} maxLength={100}
              disabled={pending} className="h-9"
              placeholder="məs. Ana kassa"
            />
          </div>
          <div>
            <Label className="text-xs">Açılış qalığı (AZN)</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={acilisQaligi}
              onChange={(e) => setAcilisQaligi(e.target.value)}
              disabled={pending} className="h-9"
            />
          </div>
          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <Link
              href="/pos"
              target="_blank" rel="noopener"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            >
              POS-da aç <ExternalLink className="h-2.5 w-2.5" />
            </Link>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                İmtina
              </Button>
              <Button type="submit" disabled={pending || ad.trim().length < 1}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Aç
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
