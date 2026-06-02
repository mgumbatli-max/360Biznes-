"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recomputeReorderRecommendations } from "../recompute-action";

export function RecomputeButton({ lastComputedAt }: { lastComputedAt: Date | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hover, setHover] = useState(false);

  function onClick() {
    startTransition(async () => {
      const r = await recomputeReorderRecommendations();
      if (r.ok) {
        toast.success(`Yeni: ${r.created} tövsiyə · Köhnə silindi: ${r.removed}`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  const ageMin = lastComputedAt ? Math.floor((Date.now() - lastComputedAt.getTime()) / 60000) : null;
  const ageText = ageMin == null
    ? "heç hesablanmayıb"
    : ageMin < 60
      ? `${ageMin} dəq əvvəl`
      : ageMin < 1440
        ? `${Math.floor(ageMin / 60)} saat əvvəl`
        : `${Math.floor(ageMin / 1440)} gün əvvəl`;

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Button size="sm" variant="outline" onClick={onClick} disabled={pending}>
        {pending ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
        )}
        {pending ? "Hesablanır..." : "Yenidən hesabla"}
      </Button>
      {hover && !pending && (
        <div className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10.5px] text-muted-foreground shadow-md">
          Son hesablama: <span className="text-foreground">{ageText}</span>
        </div>
      )}
    </div>
  );
}
