"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ExternalLink, X, PackageCheck, Loader2 } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { cancelPurchase, receivePurchase } from "../alis-actions";
import { showActionError } from "@/components/ui/action-error-toast";
import { LinkedOperationsPanel } from "@/features/emeliyyat/components/linked-operations-panel";

export function AlisRowActions({
  purchaseId,
  nomre,
  status,
  canReceive,
  canCancel,
}: {
  purchaseId: string;
  nomre: string;
  status: string | null;
  canReceive: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receivePending, startReceive] = useTransition();

  const isCancelled = status === "legv";
  const isWaiting = status === "gozlemede";

  function doReceive() {
    if (!confirm(`«${nomre}» qəbul edilsin? Stok artırılacaq.`)) return;
    startReceive(async () => {
      const res = await receivePurchase(purchaseId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${nomre} qəbul edildi — stok yeniləndi`);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-card/60 text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:scale-110 hover:bg-secondary hover:text-foreground active:scale-95"
            aria-label="Əməliyyatlar"
            title="Əməliyyatlar"
            disabled={receivePending}
          >
            {receivePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
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
            <Link href={`/ticaret/alislar/${purchaseId}`} className="cursor-pointer">
              <ExternalLink className="h-4 w-4" />
              Tam detay / redaktə
            </Link>
          </DropdownMenuItem>
          {canReceive && isWaiting && (
            <DropdownMenuItem onClick={doReceive}>
              <PackageCheck className="h-4 w-4" />
              Qəbul et (stoka medaxil)
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

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        purchaseId={purchaseId}
        nomre={nomre}
        wasReceived={status === "qebul_edildi"}
      />
    </>
  );
}

function CancelDialog({
  open,
  onOpenChange,
  purchaseId,
  nomre,
  wasReceived,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchaseId: string;
  nomre: string;
  wasReceived: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setHint(null);
    if (!reason.trim()) {
      setError("Səbəb tələb olunur");
      return;
    }
    startTransition(async () => {
      const res = await cancelPurchase(purchaseId, reason.trim());
      if (!res.ok) {
        setError(res.error);
        const hasBlockers = (res.blockers?.length ?? 0) > 0;
        setBlocked(hasBlockers);
        if (hasBlockers) setResolved(false);
        setHint(res.hint ?? null);
        showActionError(res);
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
          <DialogTitle>Alışı ləğv et — {nomre}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Alert>
            <AlertDescription className="text-xs">
              {wasReceived && "Stok geri azaldılacaq. "}
              Bağlı maliye əməliyyatları (varsa) ləğv edilib hesab qaliqi bərpa olunacaq. Təchizatçı
              borcu (varsa) azaldılacaq. Bu əməliyyat audit log-a yazılır.
            </AlertDescription>
          </Alert>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                <div>{error}</div>
                {hint && <p className="mt-1.5 text-xs opacity-90">{hint}</p>}
              </AlertDescription>
            </Alert>
          )}
          {blocked && (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <LinkedOperationsPanel
                target={{ type: "alis", id: purchaseId }}
                mode="resolve"
                onResolved={() => setResolved(true)}
              />
              {resolved && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Bağlı əməliyyatlar həll olundu — yenidən «Ləğv et» basın.
                </p>
              )}
            </div>
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
              placeholder="Yanlış sənəd / qaytarıldı / ..."
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
