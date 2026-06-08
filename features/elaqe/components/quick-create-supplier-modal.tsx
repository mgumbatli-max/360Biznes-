"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quickCreateSupplier, type QuickCreateSupplierResult } from "../quick-create-supplier";

type CreatedSupplier = Extract<QuickCreateSupplierResult, { ok: true }>["supplier"];

export function QuickCreateSupplierModal({
  open,
  onOpenChange,
  defaultAd,
  defaultTelefon,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultAd?: string;
  defaultTelefon?: string;
  onCreated: (s: CreatedSupplier) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [ad, setAd] = useState(defaultAd ?? "");
  const [telefon, setTelefon] = useState(defaultTelefon ?? "");
  const [email, setEmail] = useState("");
  const [sirketAdi, setSirketAdi] = useState("");
  const [voen, setVoen] = useState("");
  const [unvan, setUnvan] = useState("");
  const [qeyd, setQeyd] = useState("");

  useEffect(() => {
    if (!open) return;
    setAd(defaultAd ?? "");
    setTelefon(defaultTelefon ?? "");
    setEmail("");
    setSirketAdi("");
    setVoen("");
    setUnvan("");
    setQeyd("");
  }, [open, defaultAd, defaultTelefon]);

  function onSave() {
    if (ad.trim().length < 2) {
      toast.error("Təchizatçı adı ən azı 2 simvol olmalıdır");
      return;
    }
    startTransition(async () => {
      const r = await quickCreateSupplier({
        ad: ad.trim(),
        telefon: telefon.trim() || "",
        email: email.trim() || "",
        sirket_adi: sirketAdi.trim() || "",
        voen: voen.trim() || "",
        unvan: unvan.trim() || "",
        qeyd: qeyd.trim() || "",
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Təchizatçı yaradıldı: ${r.supplier.ad}`);
      onCreated(r.supplier);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-sky-600" />
            Yeni təchizatçı yarat
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="col-span-2">
            <Lbl required>Təchizatçı adı</Lbl>
            <Input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Şəxs və ya şirkət adı"
              className="h-9 text-sm"
              autoFocus
            />
          </div>
          <div>
            <Lbl>Telefon</Lbl>
            <Input
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="+994…"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Lbl>Email</Lbl>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@…"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Lbl>Şirkət adı</Lbl>
            <Input
              value={sirketAdi}
              onChange={(e) => setSirketAdi(e.target.value)}
              placeholder="MMC / FH"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Lbl>VÖEN</Lbl>
            <Input
              value={voen}
              onChange={(e) => setVoen(e.target.value)}
              placeholder="0000000000"
              className="h-9 text-sm"
            />
          </div>
          <div className="col-span-2">
            <Lbl>Ünvan</Lbl>
            <Input
              value={unvan}
              onChange={(e) => setUnvan(e.target.value)}
              placeholder="Şəhər, küçə, ev"
              className="h-9 text-sm"
            />
          </div>
          <div className="col-span-2">
            <Lbl>Qeyd</Lbl>
            <textarea
              value={qeyd}
              onChange={(e) => setQeyd(e.target.value)}
              placeholder="Daxili qeyd…"
              className="h-16 w-full rounded-md border border-border bg-background p-2 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Ləğv
          </Button>
          <Button
            onClick={onSave}
            disabled={pending}
            className="bg-sky-600 text-white hover:bg-sky-700"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Yarat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Lbl({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  );
}
