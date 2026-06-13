"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cancelSale } from "../satis-actions";
import { showActionError } from "@/components/ui/action-error-toast";
import { LinkedOperationsPanel } from "@/features/emeliyyat/components/linked-operations-panel";

export function CancelSaleDialog({ saleId, nomre }: { saleId: string; nomre: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setHint(null);
    const fd = new FormData(e.currentTarget);
    const reason = String(fd.get("reason") ?? "").trim();
    if (!reason) {
      setError("Səbəb tələb olunur");
      return;
    }
    startTransition(async () => {
      const res = await cancelSale(saleId, reason);
      if (!res.ok) {
        setError(res.error);
        const hasBlockers = (res.blockers?.length ?? 0) > 0;
        setBlocked(hasBlockers);
        if (hasBlockers) setResolved(false);
        setHint(res.hint ?? null);
        showActionError(res);
      } else {
        toast.success("Satış ləğv edildi");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <X className="h-4 w-4" /> Ləğv et
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Satışı ləğv et</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Alert>
            <AlertDescription className="text-xs">
              <strong>{nomre}</strong> ləğv ediləcək. Stok qaytarılacaq, kassa əməliyyatı tərsinə yazılacaq.
              Borc satışıdırsa müştərinin borcu azalacaq.
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
                target={{ type: "satis", id: saleId }}
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

          <div className="space-y-2">
            <Label htmlFor="reason">Səbəb *</Label>
            <textarea
              id="reason"
              name="reason"
              rows={3}
              required
              autoFocus
              maxLength={2000}
              placeholder="Müştəri imtina etdi / səhv kassa / ..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ləğv et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
