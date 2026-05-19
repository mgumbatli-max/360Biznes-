"use client";

import { useState, useTransition } from "react";
import { Plus, Check, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleLabFeature } from "../actions";

export function LabActivateButton({
  id,
  active,
  compact,
  size = "sm",
}: {
  id: string;
  active: boolean;
  compact?: boolean;
  size?: "sm" | "md";
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(active);

  const onClick = () => {
    setOptimisticActive(!optimisticActive);
    startTransition(async () => {
      const res = await toggleLabFeature(id);
      if (res.ok) setOptimisticActive(res.active);
    });
  };

  const baseSize = size === "md" ? "h-10 px-4 text-sm" : "h-8 text-xs";
  const widthCls = compact ? "flex-1" : "";

  if (optimisticActive) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={cn(
          "group inline-flex items-center justify-center gap-1.5 rounded-md border font-semibold transition disabled:opacity-50",
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15",
          baseSize, widthCls
        )}
      >
        <Check className="h-3 w-3 group-hover:hidden" />
        <Power className="hidden h-3 w-3 group-hover:inline" />
        <span className="group-hover:hidden">Aktivdir</span>
        <span className="hidden group-hover:inline">Söndür</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-50",
        baseSize, widthCls
      )}
    >
      <Plus className="h-3 w-3" />
      Aktivləşdir
    </button>
  );
}
