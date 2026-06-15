"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminUnblockIp } from "@/features/platform-admin/actions";

export function IpUnblockButton({ id }: { id: number }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function unblock() {
    setErr(null);
    start(async () => {
      const fd = new FormData();
      fd.set("id", String(id));
      const r = await adminUnblockIp(fd);
      if (r.ok) {
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {err ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-danger" title={err}>
          <AlertCircle className="h-3 w-3" /> {err}
        </span>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-success hover:bg-success/10"
        disabled={pending}
        onClick={unblock}
      >
        <Undo2 className="h-3.5 w-3.5" /> {pending ? "…" : "Blokdan çıxar"}
      </Button>
    </div>
  );
}
