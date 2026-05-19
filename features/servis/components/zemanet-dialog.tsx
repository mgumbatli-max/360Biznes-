"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { createZemanet } from "../zemanet-actions";

export function ZemanetDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createZemanet(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success("Zəmanət talonu yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Manual zəmanət
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Üçüncü tərəf zəmanəti</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="musteri_ad">Müştəri *</Label>
              <Input id="musteri_ad" name="musteri_ad" required minLength={2} maxLength={200} disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="musteri_telefon">Telefon</Label>
              <Input id="musteri_telefon" name="musteri_telefon" type="tel" maxLength={50} disabled={pending} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mehsul_ad">Məhsul *</Label>
              <Input id="mehsul_ad" name="mehsul_ad" required minLength={2} maxLength={255} disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial_nomre">Serial</Label>
              <Input id="serial_nomre" name="serial_nomre" maxLength={100} disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imei">IMEI</Label>
              <Input id="imei" name="imei" maxLength={50} disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="satis_qiymeti">Satış qiyməti</Label>
              <Input id="satis_qiymeti" name="satis_qiymeti" type="number" step="0.01" min="0" disabled={pending} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="baslama_tarixi">Başlama tarixi *</Label>
              <Input
                id="baslama_tarixi"
                name="baslama_tarixi"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ay_sayi">Müddət (ay) *</Label>
              <Input id="ay_sayi" name="ay_sayi" type="number" min="1" max="120" defaultValue={12} required disabled={pending} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd</Label>
            <textarea
              id="qeyd"
              name="qeyd"
              rows={2}
              disabled={pending}
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
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
