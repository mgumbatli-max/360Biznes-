"use client";

import { useState, useTransition } from "react";
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
import { recordSalePayment } from "../satis-actions";

type Odenis = "negd" | "kart" | "kecirme";

export function SaleRowPayDialog({
  open,
  onOpenChange,
  saleId,
  nomre,
  qaliq,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saleId: string;
  nomre: string;
  qaliq: number;
}) {
  const router = useRouter();
  const [mebleg, setMebleg] = useState<number>(qaliq);
  const [odenisNov, setOdenisNov] = useState<Odenis>("negd");
  const [qeyd, setQeyd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      toast.success(`${formatMoney(mebleg)} ödəniş qəbul edildi`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Ödəniş qəbul et — {nomre}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Alert>
            <AlertDescription className="text-xs">
              Qalıq: <span className="font-semibold">{formatMoney(qaliq)}</span>
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
              disabled={pending}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Ödəniş növü</Label>
            <div className="flex gap-1">
              {(["negd", "kart", "kecirme"] as Odenis[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setOdenisNov(v)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${
                    odenisNov === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-secondary"
                  }`}
                  disabled={pending}
                >
                  {v === "negd" ? "Nağd" : v === "kart" ? "Kart" : "Bank"}
                </button>
              ))}
            </div>
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
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Təsdiq et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
