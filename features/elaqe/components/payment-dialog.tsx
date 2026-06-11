"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { recordContactPayment } from "../actions";
import { formatMoney } from "@/lib/utils";

type Props = {
  kontragentId: string;
  ad: string;
  maxAmount: number;
  /** Render as full button instead of icon */
  variant?: "icon" | "button";
};

export function PaymentDialog({ kontragentId, ad, maxAmount, variant = "icon" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("kontragent_id", kontragentId);
    startTransition(async () => {
      const res = await recordContactPayment(fd);
      if (!res.ok) setError(res.error);
      else {
        // QA-K(Ödəniş): over-pay halında avansa keçən məbləğ açıq göstərilir
        if (res.warning) toast.warning(res.warning, { duration: 9000 });
        else toast.success("Ödəniş qeydə alındı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button size="icon-sm" variant="ghost" title="Ödəniş al" className="text-success hover:text-success">
            <CreditCard className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Ödəniş al
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Ödəniş al — {ad}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="rounded-md bg-warning/10 px-3 py-2 text-xs">
            Borc balansı: <span className="font-semibold text-warning">{formatMoney(maxAmount)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mebleg">Məbləğ (AZN) *</Label>
            <Input id="mebleg" name="mebleg" type="number" step="any" min="0.01" max={maxAmount} required defaultValue={String(maxAmount)} disabled={pending} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tarix">Tarix</Label>
            <Input id="tarix" name="tarix" type="date" defaultValue={new Date().toISOString().slice(0, 10)} disabled={pending} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qeyd">Qeyd</Label>
            <Input id="qeyd" name="qeyd" maxLength={500} placeholder="məs. nağd, kart, bank köçürməsi..." disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ödənişi qeyd et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
