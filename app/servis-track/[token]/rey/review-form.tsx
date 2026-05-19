"use client";

import { useState, useTransition } from "react";
import { Loader2, Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitCustomerReview } from "@/features/servis/actions";

export function CustomerReviewForm({ servisId }: { servisId: string }) {
  const [ulduz, setUlduz] = useState(0);
  const [hover, setHover] = useState(0);
  const [yazi, setYazi] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (ulduz < 1) {
      toast.error("Lütfən, reytinq seçin");
      return;
    }
    const fd = new FormData();
    fd.append("servis_id", servisId);
    fd.append("ulduz", String(ulduz));
    fd.append("yazi", yazi);
    startTransition(async () => {
      const res = await submitCustomerReview(fd);
      if (res.ok) {
        toast.success("Təşəkkür edirik!");
        setDone(true);
      } else toast.error(res.error);
    });
  }

  if (done) {
    return (
      <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 p-4 text-center text-sm text-emerald-300">
        <CheckCircle2 className="mx-auto h-6 w-6" />
        <p className="mt-2 font-medium">Rəyiniz qəbul edildi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setUlduz(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-1 transition hover:scale-110"
            aria-label={`${n} ulduz`}
          >
            <Star
              className={`h-8 w-8 ${
                (hover || ulduz) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>

      <div>
        <textarea
          value={yazi}
          onChange={(e) => setYazi(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Rəyinizi paylaşın (ixtiyari)…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="text-right text-[10px] text-muted-foreground">{yazi.length}/500</div>
      </div>

      <Button onClick={submit} disabled={pending || ulduz < 1} className="w-full">
        {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        Rəyi göndər
      </Button>
    </div>
  );
}
