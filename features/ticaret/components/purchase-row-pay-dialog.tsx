"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMoney } from "@/lib/utils";
import { paySupplierInvoice } from "@/features/maliyye/actions";
import { getPayablePurchaseInfoAction } from "../alis-payment-action";

type HesabOpt = { id: string; ad: string; nov: string; qaliq: number };

export function PurchaseRowPayDialog({
  open,
  onOpenChange,
  purchaseId,
  nomre,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchaseId: string;
  nomre: string;
}) {
  const router = useRouter();
  const [techizatciId, setTechizatciId] = useState<string>("");
  const [qaliq, setQaliq] = useState<number>(0);
  const [hesablar, setHesablar] = useState<HesabOpt[]>([]);
  const [mebleg, setMebleg] = useState<number>(0);
  const [hesabId, setHesabId] = useState<string>("");
  const [qeyd, setQeyd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    startLoading(async () => {
      const r = await getPayablePurchaseInfoAction(purchaseId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTechizatciId(r.techizatci_id);
      setQaliq(r.qaliq);
      setMebleg(r.qaliq);
      setHesablar(r.hesablar);
      const firstNagd = r.hesablar.find((h) => h.nov === "negd");
      setHesabId(firstNagd?.id ?? r.hesablar[0]?.id ?? "");
    });
  }, [open, purchaseId]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
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
    if (!hesabId) {
      setError("Hesab seçin");
      return;
    }
    const fd = new FormData();
    fd.set("techizatci_id", techizatciId);
    fd.set("alish_id", purchaseId);
    fd.set("mebleg", String(Math.round(mebleg * 100) / 100));
    fd.set("hesab_id", hesabId);
    if (qeyd.trim()) fd.set("qeyd", qeyd.trim());

    startTransition(async () => {
      const res = await paySupplierInvoice(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`${formatMoney(mebleg)} ödəniş təchizatçıya yazıldı`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Təchizatçıya ödəniş — {nomre}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Alert>
              <AlertDescription className="text-xs">
                Qalıq borc: <span className="font-semibold">{formatMoney(qaliq)}</span>
                {hesablar.length === 0 && (
                  <div className="mt-1 text-destructive">
                    Aktiv maliye hesabı yoxdur — əvvəlcə Maliyyə → Hesablar bölməsindən hesab yaradın.
                  </div>
                )}
              </AlertDescription>
            </Alert>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1">
              <Label>Məbləğ</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={qaliq}
                value={Number.isFinite(mebleg) ? mebleg : ""}
                onChange={(e) => setMebleg(Number(e.target.value))}
                disabled={pending || hesablar.length === 0}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Hesabdan məxariç</Label>
              <select
                value={hesabId}
                onChange={(e) => setHesabId(e.target.value)}
                disabled={pending || hesablar.length === 0}
                className="block h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">— Hesab seçin —</option>
                {hesablar.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.ad} ({h.nov === "negd" ? "Nağd" : h.nov === "bank" ? "Bank" : h.nov === "kart" ? "Kart" : h.nov}) — qaliq:{" "}
                    {formatMoney(h.qaliq)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Qeyd (ixtiyari)</Label>
              <Input
                value={qeyd}
                onChange={(e) => setQeyd(e.target.value)}
                disabled={pending}
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                İmtina
              </Button>
              <Button type="submit" disabled={pending || hesablar.length === 0}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Ödəniş et
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
