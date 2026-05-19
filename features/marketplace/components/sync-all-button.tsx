"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncAllMarketplaces } from "../multisync-actions";

export function SyncAllButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<{ synced: number; failed: number } | null>(null);

  function onClick() {
    startTransition(async () => {
      const r = await syncAllMarketplaces();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const { synced, failed } = r.data ?? { synced: 0, failed: 0 };
      setLastResult({ synced, failed });
      if (failed === 0) {
        toast.success(`${synced} platforma sync olundu`);
      } else {
        toast.warning(`${synced} uğurlu, ${failed} xəta`);
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      disabled={pending}
      className="font-semibold text-white"
      style={{ background: "var(--brand-gradient)" }}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : lastResult ? (
        lastResult.failed === 0 ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      Hamısını Sync et
    </Button>
  );
}
