"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
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
import { formatMoney } from "@/lib/utils";
import { recordSalePayment } from "../satis-actions";

type Odenis = "negd" | "kart" | "kecirme";

export function SalePaymentDialog({
  saleId,
  qaliq,
}: {
  saleId: string;
  qaliq: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mebleg, setMebleg] = useState<number>(qaliq);
  const [odenisNov, setOdenisNov] = useState<Odenis>("negd");
  const [qeyd, setQeyd] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!(mebleg > 0)) {
      setError("Məbləğ 0-dan böyük olmalıdır");
      return;
    }
    if (mebleg > qaliq + 0.01) {
      setError(`Məbləğ qalıqdan (${formatMoney(qaliq)}) çox ola bilməz`);
      return;
    }
    startTransition(async () => {
      const res = await recordSalePayment(
        saleId,
        Math.round(mebleg * 100) / 100,
        odenisNov,
        qeyd.trim() || null,
      );
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Ödəniş əlavə edildi");
      setOpen(false);
      setQeyd("");
      setMebleg(0);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Wallet className="h-3.5 w-3.5" /> Ödəniş əlavə et
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Ödəniş əlavə et</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <Alert>
            <AlertDescription className="text-xs">
              Qalıq borc: <strong className="text-warning">{formatMoney(qaliq)}</strong>
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label htmlFor="mebleg">Məbləğ (₼) *</Label>
            <Input
              id="mebleg"
              type="number"
              step="0.01"
              min={0}
              max={qaliq}
              value={mebleg}
              onChange={(e) => setMebleg(Math.max(0, Number(e.target.value) || 0))}
              required
              autoFocus
              disabled={pending}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="odenis_nov">Ödəniş üsulu</Label>
            <select
              id="odenis_nov"
              value={odenisNov}
              onChange={(e) => setOdenisNov(e.target.value as Odenis)}
              disabled={pending}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="negd">Nağd</option>
              <option value="kart">Kart</option>
              <option value="kecirme">Köçürmə</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="qeyd">Qeyd</Label>
            <Input
              id="qeyd"
              value={qeyd}
              onChange={(e) => setQeyd(e.target.value)}
              placeholder="Səbəb, qəbz nömrəsi..."
              maxLength={200}
              disabled={pending}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Ləğv et
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ödəniş et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
