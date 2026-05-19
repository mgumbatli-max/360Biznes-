"use client";

import { useTransition } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { takeSnapshot } from "@/features/sahibkar/owner-actions";

export function SnapshotButton() {
  const [isPending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() => start(async () => { await takeSnapshot(); })}
    >
      <Camera className="h-3.5 w-3.5" /> {isPending ? "Alınır…" : "Snapshot al"}
    </Button>
  );
}
