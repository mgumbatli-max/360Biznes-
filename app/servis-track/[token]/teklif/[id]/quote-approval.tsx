"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { customerApproveQuote } from "@/features/servis/actions";

export function CustomerQuoteApproval({ servisId }: { servisId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(approved: boolean) {
    if (!approved && reason.trim().length < 3) {
      toast.error("Rədd səbəbini qeyd edin (3+ simvol)");
      return;
    }
    const fd = new FormData();
    fd.append("servis_id", servisId);
    fd.append("approved", approved ? "true" : "false");
    fd.append("reason", reason);
    startTransition(async () => {
      const res = await customerApproveQuote(fd);
      if (res.ok) {
        toast.success(approved ? "Təklif təsdiq edildi" : "Təklif rədd edildi");
        setDone(true);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (done) {
    return (
      <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 p-4 text-center text-sm text-emerald-300">
        <CheckCircle2 className="mx-auto h-6 w-6" />
        <p className="mt-2 font-medium">Cavabınız qəbul edildi. Mağaza ilə əlaqə saxlanılacaq.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border/40 bg-card/40 p-4">
      <div className="text-sm font-medium">Təklifə cavab verin</div>
      {decision === "reject" && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rədd səbəbi</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Qiymət uyğun deyil / başqa məkanda təmir etdirəcəm / …"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() => {
            if (decision === "reject") setDecision(null);
            submit(true);
          }}
          disabled={pending}
          className="w-full"
        >
          {pending && decision !== "reject" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          Təsdiq et
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (decision === "reject" ? submit(false) : setDecision("reject"))}
          disabled={pending}
          className="w-full"
        >
          {pending && decision === "reject" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
          )}
          {decision === "reject" ? "Rədd təsdiq" : "Rədd et"}
        </Button>
      </div>
    </div>
  );
}
