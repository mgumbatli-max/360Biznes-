"use client";

import { useTransition } from "react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { impersonateTenant } from "../actions";

export function ImpersonateButton({ tenantId, tenantAd }: { tenantId: string; tenantAd: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    if (!confirm(`"${tenantAd}" sahibkar kimi giriş edək? Hərəkət audit log-a yazılacaq.`)) return;
    start(async () => {
      try {
        await impersonateTenant(tenantId);
        // redirect happens server-side
      } catch (e) {
        // NEXT_REDIRECT is thrown by redirect() — bu normal davranışdır
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
          return;
        }
        console.error(e);
        toast.error("Impersonate alınmadı");
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={onClick}>
      <LogIn className="h-3.5 w-3.5" /> {pending ? "Giriş edilir…" : "Bu sahibkar kimi giriş et"}
    </Button>
  );
}
