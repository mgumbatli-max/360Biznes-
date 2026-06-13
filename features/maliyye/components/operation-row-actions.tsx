"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Eye,
  Check,
  X,
  Ban,
  Loader2,
  ExternalLink,
  User,
  Truck,
  Building2,
  Receipt,
  ShoppingCart,
  Wrench,
  Copy,
  Printer,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OperationDetailDrawer } from "./operation-detail-drawer";
import { approveOperation, rejectOperation, cancelOperation } from "../actions";
import type { OperationRow } from "../operations-queries";

export function OperationRowActions({
  op,
  canApprove,
  canCancel,
}: {
  op: OperationRow;
  canApprove: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpenDialog, setCancelOpenDialog] = useState(false);
  const [pending, startTransition] = useTransition();

  const isPending = op.status === "tesdiq_gozleyir" || op.status === "gozleyir";
  const isActive = op.status === "aktiv";
  const isCancelled = op.status === "legv" || op.status === "redd";

  function doApprove() {
    startTransition(async () => {
      const r = await approveOperation(op.id);
      if (!r.ok) {
        toast.error(r.error ?? "Xəta");
        return;
      }
      toast.success("Təsdiqləndi");
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
            disabled={pending}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {op.sened_nomresi ?? op.type_ad}
            {isCancelled && (
              <span className="ml-1 rounded bg-destructive/15 px-1 py-px text-[9px] text-destructive">
                {op.status === "legv" ? "Ləğv" : "Rədd"}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setDrawerOpen(true)}>
            <Eye className="h-4 w-4" />
            Tam detay / sənədlər
          </DropdownMenuItem>
          {op.sened_nomresi && (
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(op.sened_nomresi!);
                toast.success(`Sənəd nömrəsi kopyalandı: ${op.sened_nomresi}`);
              }}
            >
              <Copy className="h-4 w-4" />
              Sənəd № kopya
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <a href={`/maliyye/emeliyyat/${op.id}/print?auto=1`} target="_blank" rel="noopener">
              <Printer className="h-4 w-4" />
              Qəbz çap
            </a>
          </DropdownMenuItem>

          {/* Bağlı sənədlər (varsa) */}
          {(op.kontragent_id || op.isci_id || op.satis_id || op.alish_id || op.servis_id || op.hesab_id) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Bağlı sənədlər
              </DropdownMenuLabel>
              {op.kontragent_id && op.kontragent_ad && (
                <DropdownMenuItem asChild>
                  <Link
                    href={
                      op.kontragent_nov === "techizatci"
                        ? `/elaqe/techizatcilar/${op.kontragent_id}`
                        : `/elaqe/musteriler/${op.kontragent_id}`
                    }
                  >
                    {op.kontragent_nov === "techizatci" ? (
                      <Truck className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    <span className="truncate">{op.kontragent_ad}</span>
                    <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                  </Link>
                </DropdownMenuItem>
              )}
              {op.satis_id && (
                <DropdownMenuItem asChild>
                  <Link href={`/ticaret/satislar/${op.satis_id}`}>
                    <Receipt className="h-4 w-4" />
                    Bağlı satış {op.satis_nomre && `#${op.satis_nomre}`}
                    <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                  </Link>
                </DropdownMenuItem>
              )}
              {op.alish_id && (
                <DropdownMenuItem asChild>
                  <Link href={`/ticaret/alislar/${op.alish_id}`}>
                    <ShoppingCart className="h-4 w-4" />
                    Bağlı alış {op.alish_nomre && `#${op.alish_nomre}`}
                    <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                  </Link>
                </DropdownMenuItem>
              )}
              {op.servis_id && (
                <DropdownMenuItem asChild>
                  <Link href={`/servis/${op.servis_id}`}>
                    <Wrench className="h-4 w-4" />
                    Bağlı servis
                    <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                  </Link>
                </DropdownMenuItem>
              )}
              {op.isci_id && op.isci_ad && (
                <DropdownMenuItem asChild>
                  <Link href={`/iscilier/${op.isci_id}`}>
                    <User className="h-4 w-4" />
                    İşçi: {op.isci_ad}
                    <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                  </Link>
                </DropdownMenuItem>
              )}
              {op.hesab_id && op.hesab_ad && (
                <DropdownMenuItem asChild>
                  <Link href={`/maliyye/hesab/${op.hesab_id}`}>
                    <Building2 className="h-4 w-4" />
                    Hesab: {op.hesab_ad}
                    <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                  </Link>
                </DropdownMenuItem>
              )}
            </>
          )}

          {canApprove && isPending && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={doApprove}>
                <Check className="h-4 w-4" />
                Təsdiqlə
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRejectOpen(true)}>
                <X className="h-4 w-4" />
                Rədd et
              </DropdownMenuItem>
            </>
          )}
          {canCancel && isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setCancelOpenDialog(true)}>
                <Ban className="h-4 w-4" />
                Ləğv et
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Detay drawer — açıq saxla, öz trigger-i gizlət */}
      {drawerOpen && (
        <OperationDetailDrawer
          op={op}
          defaultOpen
          hideTrigger
          onOpenChange={(v) => !v && setDrawerOpen(false)}
        />
      )}

      <ReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Rədd et — ${op.sened_nomresi ?? op.type_ad}`}
        warningText="Əməliyyat rədd ediləcək. Audit log-a yazılır."
        confirmLabel="Rədd et"
        onConfirm={async (reason) => {
          const r = await rejectOperation(op.id, reason);
          if (!r.ok) {
            toast.error(r.error ?? "Xəta");
            return false;
          }
          toast.success("Rədd edildi");
          router.refresh();
          return true;
        }}
      />
      <ReasonDialog
        open={cancelOpenDialog}
        onOpenChange={setCancelOpenDialog}
        title={`Ləğv et — ${op.sened_nomresi ?? op.type_ad}`}
        warningText="Əməliyyat ləğv ediləcək, hesab qaliqi tərsinə yazılacaq. Audit log-a yazılır."
        confirmLabel="Ləğv et"
        onConfirm={async (reason) => {
          const r = await cancelOperation(op.id, reason);
          if (!r.ok) {
            toast.error(r.error ?? "Xəta");
            return false;
          }
          toast.success("Ləğv edildi");
          router.refresh();
          return true;
        }}
      />
    </>
  );
}

function ReasonDialog({
  open,
  onOpenChange,
  title,
  warningText,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  warningText: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
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
      const ok = await onConfirm(reason.trim());
      if (ok) {
        setReason("");
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Alert>
            <AlertDescription className="text-xs">{warningText}</AlertDescription>
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
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
