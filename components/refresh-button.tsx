"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RefreshButton({ label }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spin, setSpin] = useState(false);

  function refresh() {
    setSpin(true);
    startTransition(() => {
      router.refresh();
      setTimeout(() => setSpin(false), 500);
    });
  }

  return (
    <Button size="sm" variant="ghost" onClick={refresh} disabled={pending} title="Yenilə">
      <RotateCw className={cn("h-3.5 w-3.5", spin && "animate-spin")} />
      {label && <span className="ml-1">{label}</span>}
    </Button>
  );
}
