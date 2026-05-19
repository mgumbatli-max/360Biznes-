"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllRead } from "../actions";

export function MarkAllReadButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (count === 0) return;
    startTransition(async () => {
      const r = await markAllRead();
      if (r.ok) {
        toast.success(`${r.count} xəbərdarlıq oxundu kimi qeyd edildi`);
        router.refresh();
      } else toast.error("Alınmadı");
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={pending || count === 0} onClick={onClick} className="h-8 text-xs">
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
      Hamısını oxunmuş işarələ
    </Button>
  );
}
