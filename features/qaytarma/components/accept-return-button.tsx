"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { acceptReturn } from "../actions";

export function AcceptReturnButton({ id, nomre }: { id: string; nomre: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`${nomre} qaytarmasını qəbul edib stoku dəyişməyə əminsən?`)) return;
    startTransition(async () => {
      const res = await acceptReturn(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Qaytarma qəbul edildi");
      router.refresh();
    });
  }

  return (
    <Button size="sm" onClick={onClick} disabled={pending} className="h-7 px-2 text-xs">
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      Qəbul
    </Button>
  );
}
