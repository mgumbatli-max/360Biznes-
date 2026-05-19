"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Send, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { changeSaleStatus } from "../satis-actions";

type Status = "yeni" | "tesdiq" | "gonderildi" | "tamamlandi";

const NEXT_STATUS: Record<string, { to: Status; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  yeni: [{ to: "tesdiq", label: "Təsdiqlə", icon: CheckCircle2 }],
  tesdiq: [{ to: "gonderildi", label: "Göndərildi", icon: Send }],
  gonderildi: [{ to: "tamamlandi", label: "Tamamlandı", icon: PackageCheck }],
};

export function SaleStatusButtons({ saleId, status }: { saleId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const actions = NEXT_STATUS[status] ?? [];
  if (actions.length === 0) return null;

  function go(to: Status) {
    startTransition(async () => {
      const res = await changeSaleStatus(saleId, to);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Status yeniləndi");
      router.refresh();
    });
  }

  return (
    <>
      {actions.map((a) => (
        <Button
          key={a.to}
          size="sm"
          variant="outline"
          onClick={() => go(a.to)}
          disabled={pending}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <a.icon className="h-3.5 w-3.5" />}
          {a.label}
        </Button>
      ))}
    </>
  );
}
