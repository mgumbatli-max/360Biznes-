"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTenantModule } from "@/features/platform-admin/actions";

type Props = {
  sahibkarId: string;
  modulKod: string;
  aktiv: boolean;
};

/**
 * Per-tenant modul aç/söndür düyməsi. setTenantModule-u {sahibkar_id, modul_kod,
 * aktiv:!current} ilə çağırır; uğurda router.refresh() ilə cədvəli yeniləyir.
 * Xəta inline (düymənin altında) göstərilir.
 */
export function ModuleToggle({ sahibkarId, modulKod, aktiv }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sahibkar_id", sahibkarId);
      fd.set("modul_kod", modulKod);
      fd.set("aktiv", aktiv ? "false" : "true");
      const res = await setTenantModule(fd);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={toggle}
        className={
          aktiv
            ? "border-danger/30 text-danger hover:bg-danger/10"
            : "border-success/30 text-success hover:bg-success/10"
        }
        aria-label={aktiv ? `${modulKod} modulunu söndür` : `${modulKod} modulunu aktivləşdir`}
      >
        {aktiv ? (
          <>
            <PowerOff className="h-3.5 w-3.5" /> Söndür
          </>
        ) : (
          <>
            <Power className="h-3.5 w-3.5" /> Aktivləşdir
          </>
        )}
      </Button>
      {error ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-danger" title={error}>
          <AlertCircle className="h-3 w-3 shrink-0" /> {error}
        </span>
      ) : null}
    </div>
  );
}
