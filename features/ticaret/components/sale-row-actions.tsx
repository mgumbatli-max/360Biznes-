"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ExternalLink, Wallet, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { cancelSale, recordSalePayment } from "../satis-actions";

type Odenis = "negd" | "kart" | "kecirme";

export function SaleRowActions({
  saleId,
  nomre,
  status,
  qaliq,
  canPay,
  canCancel,
}: {
  saleId: string;
  nomre: string;
  status: string | null;
  qaliq: number;
  canPay: boolean;
  canCancel: boolean;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const isCancelled = status === "legv";
  const hasOpenBalance = qaliq > 0 && !isCancelled;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-card/60 text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:scale-110 hover:bg-secondary hover:text-foreground active:scale-95"
            aria-label="Əməliyyatlar"
            title="Əməliyyatlar"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {nomre}
            {isCancelled && (
              <span className="ml-1 rounded bg-destructive/15 px-1 py-px text-[9px] text-destructive">
                Ləğv
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/ticaret/satislar/${saleId}`} className="cursor-pointer">
              <ExternalLink className="h-4 w-4" />
              Tam detay / redaktə
            </Link>
          </DropdownMenuItem>
          {canPay && hasOpenBalance && (
            <DropdownMenuItem onClick={() => setPayOpen(true)}>
              <Wallet className="h-4 w-4" />
              Ödəniş qəbul et ({formatMoney(qaliq)})
            </DropdownMenuItem>
          )}
          {canCancel && !isCancelled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
                <X className="h-4 w-4" />
                Ləğv et
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <PayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        saleId={saleId}
        nomre={nomre}
        qaliq={qaliq}
      />
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        saleId={saleId}
        nomre={nomre}
      />
    </>
  );
}

function PayDialog({
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

function CancelDialog({
  open,
  onOpenChange,
  saleId,
  nomre,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saleId: string;
  nomre: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError("Səbəb tələb olunur");
      return;
    }
    startTransition(async () => {
      const res = await cancelSale(saleId, reason.trim());
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`${nomre} ləğv edildi`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Satışı ləğv et — {nomre}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Alert>
            <AlertDescription className="text-xs">
              Stok geri qaytarılacaq, kassa əməliyyatı tərsinə yazılacaq. Borc satışıdırsa müştərinin
              borcu azalacaq. Bu əməliyyat audit log-a yazılır.
            </AlertDescription>
          </Alert>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1">
            <Label>Səbəb *</Label>
            <textarea
              rows={3}
              required
              autoFocus
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Müştəri imtina etdi / səhv kassa / ..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
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
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ləğv et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
