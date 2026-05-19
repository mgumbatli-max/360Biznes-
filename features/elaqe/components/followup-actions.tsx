"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { completeFollowup } from "../actions";

export function CompleteFollowupButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await completeFollowup(id);
      if (res.ok) {
        toast.success("Tamamlandı");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Button size="icon-sm" variant="ghost" onClick={onClick} disabled={pending} title="Tamamlandı işarələ">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
    </Button>
  );
}
