"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, Loader2, FileText, ExternalLink } from "lucide-react";
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
import { deleteExpense } from "../actions";

export function ExpenseRowActions({
  id,
  tesvir,
  isDeleted,
  invoiceId,
  faylUrl,
  canDelete,
}: {
  id: string;
  tesvir: string;
  isDeleted: boolean;
  invoiceId: string | null;
  faylUrl: string | null;
  canDelete: boolean;
}) {
  const [delOpen, setDelOpen] = useState(false);

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
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground line-clamp-1">
            {tesvir.slice(0, 28)}
            {isDeleted && (
              <span className="ml-1 rounded bg-destructive/15 px-1 py-px text-[9px] text-destructive">
                Silinib
              </span>
            )}
          </DropdownMenuLabel>
          {invoiceId && (
            <DropdownMenuItem asChild>
              <a href={`/ticaret/alislar/${invoiceId}`} className="cursor-pointer">
                <ExternalLink className="h-4 w-4" />
                Bağlı qaiməyə bax
              </a>
            </DropdownMenuItem>
          )}
          {faylUrl && (
            <DropdownMenuItem asChild>
              <a href={faylUrl} target="_blank" rel="noopener" className="cursor-pointer">
                <FileText className="h-4 w-4" />
                Sənəd / qəbz
              </a>
            </DropdownMenuItem>
          )}
          {canDelete && !isDeleted && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDelOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Sil
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        expenseId={id}
        tesvir={tesvir}
      />
    </>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  expenseId,
  tesvir,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expenseId: string;
  tesvir: string;
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
      const res = await deleteExpense(expenseId, reason.trim());
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Xərc silindi (soft-delete)");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Xərci sil</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Alert>
            <AlertDescription className="text-xs">
              «{tesvir}» soft-delete olunacaq — sahibkar/admin filtrlə yenidən görə bilər. Audit
              log-a yazılır.
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
              Sil
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
