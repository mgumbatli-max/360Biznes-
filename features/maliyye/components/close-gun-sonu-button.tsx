"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Moon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { closeGunSonu } from "../actions";

export function CloseGunSonuButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function onClick() {
    if (!confirm("Günü bağlayırsınız. Davam edilsin?")) return;
    startTransition(async () => {
      const res = await closeGunSonu();
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Gün bağlandı");
        router.refresh();
      }
    });
  }
  return (
    <Button onClick={onClick} disabled={pending || disabled} className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Moon className="mr-2 h-4 w-4" />}
      {disabled ? "Bağlanıb" : "Günü bağla"}
    </Button>
  );
}
