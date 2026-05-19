"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelReturn } from "../actions";

/**
 * Cancel-pending-return action button. Only renders for status="tesdiqlenmemis"
 * rows. Opens a dialog asking for a reason (required) and calls
 * `cancelReturn(id, reason)` server action. Stock is not touched because
 * the return was never accepted.
 */
export function CancelReturnButton({ id, nomre }: { id: string; nomre: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function onCancel() {
    if (!reason.trim()) {
      toast.error("Səbəb tələb olunur");
      return;
    }
    startTransition(async () => {
      const res = await cancelReturn(id, reason.trim());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${nomre} ləğv edildi`);
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-7 px-2 text-xs text-danger hover:bg-danger/10 hover:text-danger"
        title="Ləğv et"
      >
        <X className="h-3 w-3" />
        Ləğv et
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Qaytarmanı ləğv et</DialogTitle>
            <DialogDescription>
              <strong>{nomre}</strong> ləğv ediləcək. Bu əməliyyat stoka təsir etmir,
              çünki qaytarma hələ qəbul edilməyib.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cr-reason">Ləğv səbəbi</Label>
            <Input
              id="cr-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="məs: müştəri vaz keçdi"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Geri qayıt
            </Button>
            <Button
              onClick={onCancel}
              disabled={pending || !reason.trim()}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Ləğv et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
