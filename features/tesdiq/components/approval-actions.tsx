"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { approveRequest, rejectRequest } from "../actions";

export function ApprovalActions({ id }: { id: number }) {
  const router = useRouter();
  const [openReject, setOpenReject] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function onApprove() {
    startTransition(async () => {
      const res = await approveRequest(id);
      if (res.ok) {
        toast.success("Təsdiqləndi");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onReject() {
    if (!reason.trim()) {
      toast.error("Səbəb tələb olunur");
      return;
    }
    startTransition(async () => {
      const res = await rejectRequest(id, reason);
      if (res.ok) {
        toast.success("Rədd edildi");
        setOpenReject(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className="border-success/30 text-success hover:bg-success/10"
          onClick={onApprove}
          disabled={pending}
        >
          <Check className="h-3.5 w-3.5" /> Təsdiq
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-danger/30 text-danger hover:bg-danger/10"
          onClick={() => setOpenReject(true)}
          disabled={pending}
        >
          <X className="h-3.5 w-3.5" /> Rədd
        </Button>
      </div>

      <Dialog open={openReject} onOpenChange={setOpenReject}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Təsdiq tələbini rədd et</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reason">Səbəb *</Label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                autoFocus
                className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={pending}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenReject(false)} disabled={pending}>
                İmtina
              </Button>
              <Button type="button" variant="destructive" onClick={onReject} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Rədd et
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
