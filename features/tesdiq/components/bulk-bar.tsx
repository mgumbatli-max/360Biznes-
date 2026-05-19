"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { bulkApprove, bulkReject } from "../actions";

/**
 * Lightweight checkbox-tracker that lives at the page top.
 * Listens to checkbox changes via DOM (data-tesdiq-id attribute on each row checkbox)
 * and exposes Approve/Reject all selected buttons.
 */
export function BulkBar() {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [openReject, setOpenReject] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  // Track selection via document-level event listener
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target?.matches?.("[data-tesdiq-id]")) return;
      const id = Number(target.getAttribute("data-tesdiq-id"));
      if (!id) return;
      setSelected((prev) => target.checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id));
    };
    document.addEventListener("change", handler);
    return () => document.removeEventListener("change", handler);
  }, []);

  const onApprove = () => {
    if (!selected.length) return;
    startTransition(async () => {
      const res = await bulkApprove(selected);
      if (res.ok) {
        toast.success(`${res.affected} tələb təsdiqləndi`);
        setSelected([]);
        // Uncheck UI checkboxes
        document.querySelectorAll<HTMLInputElement>("[data-tesdiq-id]:checked").forEach((el) => (el.checked = false));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const onReject = () => {
    if (!selected.length || !reason.trim()) return;
    startTransition(async () => {
      const res = await bulkReject(selected, reason);
      if (res.ok) {
        toast.success(`${res.affected} tələb rədd edildi`);
        setSelected([]);
        setReason("");
        setOpenReject(false);
        document.querySelectorAll<HTMLInputElement>("[data-tesdiq-id]:checked").forEach((el) => (el.checked = false));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  if (selected.length === 0) return null;

  return (
    <>
      <div className="sticky top-2 z-20 flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 shadow-md backdrop-blur">
        <span className="text-sm font-bold text-primary">{selected.length} tələb seçilib</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { setSelected([]); document.querySelectorAll<HTMLInputElement>("[data-tesdiq-id]:checked").forEach((el) => (el.checked = false)); }}>
            Ləğv et
          </Button>
          <Button size="sm" variant="outline" className="border-success/30 bg-success/10 text-success hover:bg-success/15" onClick={onApprove} disabled={pending}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Hamısını təsdiqlə
          </Button>
          <Button size="sm" variant="outline" className="border-danger/30 bg-danger/10 text-danger hover:bg-danger/15" onClick={() => setOpenReject(true)} disabled={pending}>
            <X className="h-3 w-3" />
            Hamısını rədd et
          </Button>
        </div>
      </div>

      <Dialog open={openReject} onOpenChange={setOpenReject}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>{selected.length} tələbi rədd et</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bütün seçilmiş tələblər eyni səbəblə rədd ediləcək.
            </p>
            <div className="space-y-2">
              <Label htmlFor="bulk-reason">Səbəb *</Label>
              <textarea
                id="bulk-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
                className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenReject(false)} disabled={pending}>İmtina</Button>
              <Button type="button" variant="destructive" onClick={onReject} disabled={pending || !reason.trim()}>
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
