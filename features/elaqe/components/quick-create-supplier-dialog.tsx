"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, Loader2, UserPlus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickCreateSupplier } from "../quick-create-supplier";

type Props = {
  /** Default ad — combobox-da daxil edilən axtarış mətni ötürülə bilər */
  defaultName?: string;
  /** Yaradıldıqdan sonra callback */
  onCreated: (supplier: { id: string; ad: string; telefon: string | null }) => void;
  /** Yalnız + ikonlu kiçik düymə (combobox yanında) */
  variant?: "icon" | "button";
};

export function QuickCreateSupplierDialog({ defaultName, onCreated, variant = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [ad, setAd] = useState(defaultName ?? "");
  const [telefon, setTelefon] = useState("");
  const [voen, setVoen] = useState("");
  const [sirket, setSirket] = useState("");
  const [qeyd, setQeyd] = useState("");

  function reset() {
    setAd(defaultName ?? ""); setTelefon(""); setVoen(""); setSirket(""); setQeyd(""); setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (ad.trim().length < 2) { setError("Ad ən azı 2 simvol"); return; }
    startTransition(async () => {
      const r = await quickCreateSupplier({
        ad: ad.trim(),
        telefon: telefon.trim(),
        sirket_adi: sirket.trim(),
        voen: voen.trim(),
        qeyd: qeyd.trim(),
      });
      if (r.ok) {
        toast.success(`Təchizatçı yaradıldı: ${r.supplier.ad}`);
        onCreated(r.supplier);
        setOpen(false);
        reset();
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
            title="Yeni təchizatçı"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-background hover:bg-secondary"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5" /> Yeni təchizatçı
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Sürətli təchizatçı yarat
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <div className="rounded-md border border-rose-500/40 bg-rose-50 p-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          <div>
            <Label className="text-xs">Ad / şirkət *</Label>
            <Input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              autoFocus
              required
              minLength={2}
              maxLength={200}
              disabled={pending}
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Telefon</Label>
              <Input
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                maxLength={30}
                disabled={pending}
                className="h-9"
                placeholder="+994..."
              />
            </div>
            <div>
              <Label className="text-xs">VÖEN</Label>
              <Input
                value={voen}
                onChange={(e) => setVoen(e.target.value)}
                maxLength={20}
                disabled={pending}
                className="h-9 font-mono"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Şirkət (tam)</Label>
            <Input
              value={sirket}
              onChange={(e) => setSirket(e.target.value)}
              maxLength={200}
              disabled={pending}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Qeyd</Label>
            <Input
              value={qeyd}
              onChange={(e) => setQeyd(e.target.value)}
              maxLength={2000}
              disabled={pending}
              className="h-9"
            />
          </div>
          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <Link
              href={`/elaqe/techizatcilar?yeni=1${ad ? `&name=${encodeURIComponent(ad)}` : ""}`}
              target="_blank"
              rel="noopener"
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
