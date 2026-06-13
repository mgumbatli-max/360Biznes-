"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  UserPlus,
  ShoppingCart,
  XCircle,
  Trash2,
  Loader2,
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
import { LeadDialog } from "./lead-dialog";
import { convertLeadToMusteri, convertLeadToSale, deleteLead } from "../actions";
import { loseLead } from "../leadler-actions";
import type { LeadCard } from "../types";

export function LeadRowActions({
  lead,
  canEdit,
  canConvert,
  canDelete,
}: {
  lead: LeadCard;
  canEdit: boolean;
  canConvert: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [loseOpen, setLoseOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isDeleted = lead.status === "silinib";
  // QA #13: əsl status "itirdi"-dir; "itirildi" heç vaxt uyğun gəlmirdi
  const isLost = lead.status === "itirdi";

  function doConvertMusteri() {
    startTransition(async () => {
      const r = await convertLeadToMusteri(lead.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Müştəriyə çevrildi");
      router.refresh();
    });
  }

  function doConvertSale() {
    startTransition(async () => {
      const r = await convertLeadToSale(lead.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Satış qaralaması yaradıldı");
      router.push(`/ticaret/satislar/${r.saleId}`);
    });
  }

  function doDelete() {
    if (!confirm(`«${lead.ad}» soft-delete edilsin? Audit log-a yazılır.`)) return;
    startTransition(async () => {
      const r = await deleteLead(lead.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Silindi");
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
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground line-clamp-1">
            {lead.ad}
            {isDeleted && (
              <span className="ml-1 rounded bg-destructive/15 px-1 py-px text-[9px] text-destructive">
                Silinib
              </span>
            )}
            {isLost && (
              <span className="ml-1 rounded bg-warning/15 px-1 py-px text-[9px] text-warning">
                İtirildi
              </span>
            )}
          </DropdownMenuLabel>
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Redaktə et
            </DropdownMenuItem>
          )}
          {canConvert && !isDeleted && !isLost && (
            <>
              <DropdownMenuItem onClick={doConvertMusteri}>
                <UserPlus className="h-4 w-4" />
                Müştəriyə çevir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={doConvertSale}>
                <ShoppingCart className="h-4 w-4" />
                Satışa çevir
              </DropdownMenuItem>
            </>
          )}
          {canEdit && !isLost && !isDeleted && (
            <DropdownMenuItem onClick={() => setLoseOpen(true)}>
              <XCircle className="h-4 w-4" />
              İtirildi olaraq qeyd et
            </DropdownMenuItem>
          )}
          {canDelete && !isDeleted && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={doDelete}>
                <Trash2 className="h-4 w-4" />
                Sil
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen && (
        <LeadDialog
          initial={lead}
          trigger="edit"
          hideTrigger
          defaultOpen
          onOpenChange={(v) => !v && setEditOpen(false)}
        />
      )}

      <LoseDialog open={loseOpen} onOpenChange={setLoseOpen} leadId={lead.id} ad={lead.ad} />
    </>
  );
}

function LoseDialog({
  open,
  onOpenChange,
  leadId,
  ad,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  ad: string;
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
      const r = await loseLead(leadId, reason.trim());
      if (!r.ok) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("İtirildi olaraq qeyd edildi");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>İtirildi — {ad}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Alert>
            <AlertDescription className="text-xs">
              Lead «itirildi» kimi qeyd ediləcək. Audit log-a yazılır.
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
              placeholder="Rəqib seçdi / büdcə kifayət etmir / ..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Qeyd et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
