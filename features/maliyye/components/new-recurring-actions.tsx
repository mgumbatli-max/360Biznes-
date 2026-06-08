"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleRecurringRule, deleteRecurringRule } from "../recurring-rules-actions";

export function NewRecurringActions({ id, aktiv }: { id: string; aktiv: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onToggle() {
    startTransition(async () => {
      const r = await toggleRecurringRule(id, !aktiv);
      if (r.ok) {
        toast.success(aktiv ? "Söndürüldü" : "Aktivləşdirildi");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function onDelete() {
    if (!confirm("Bu qaydanı silməyə əminsiniz?")) return;
    startTransition(async () => {
      const r = await deleteRecurringRule(id);
      if (r.ok) {
        toast.success("Silindi");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" onClick={onToggle} disabled={pending} className="h-7 text-[11px]">
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : aktiv ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {aktiv ? "Söndür" : "Aktivləşdir"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDelete} disabled={pending} className="h-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
