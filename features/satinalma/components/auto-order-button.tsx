"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { autoCreatePurchaseOrders } from "../actions";

export function AutoOrderButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (count === 0) return;
    if (!confirm(`${count} tövsiyə əsasında alış sifarişləri yaradılsın?`)) return;
    startTransition(async () => {
      const r = await autoCreatePurchaseOrders();
      if (r.ok) {
        toast.success(`${r.count} sifariş yaradıldı`);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={pending || count === 0}
      className="font-semibold text-white"
      style={{ background: "var(--brand-gradient)" }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
      Avto sifariş yarat ({count})
    </Button>
  );
}
