"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { createAccount } from "../actions";

export function AccountDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [nov, setNov] = useState("bank");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createAccount(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success("Hesab yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" />
          Yeni hesab
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni hesab</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="ad">Ad *</Label>
            <Input id="ad" name="ad" required maxLength={100} disabled={pending} autoFocus placeholder="Məs: ABB cari hesab" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nov">Növ *</Label>
              <select
                id="nov" name="nov" value={nov} onChange={(e) => setNov(e.target.value)} disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="bank">Bank hesabı</option>
                <option value="kart">Kart hesabı</option>
                <option value="negd">Nağd kassa</option>
                <option value="e_pul">E-pul</option>
                <option value="diger">Digər</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valyuta">Valyuta</Label>
              <select id="valyuta" name="valyuta" defaultValue="AZN" disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="AZN">AZN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
                <option value="RUB">RUB</option>
              </select>
            </div>
          </div>

          {(nov === "bank" || nov === "kart") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank_adi">Bank adı</Label>
                <Input id="bank_adi" name="bank_adi" maxLength={100} disabled={pending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kart_son4">Kart son 4 (məs: 1234)</Label>
                <Input id="kart_son4" name="kart_son4" maxLength={4} disabled={pending} />
              </div>
            </div>
          )}

          {nov === "bank" && (
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input id="iban" name="iban" maxLength={50} disabled={pending} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="qaliq">Başlanğıc balans</Label>
            <Input id="qaliq" name="qaliq" type="number" step="0.01" defaultValue="0" disabled={pending} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd</Label>
            <Input id="qeyd" name="qeyd" disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
