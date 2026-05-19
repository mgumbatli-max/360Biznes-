"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Rows3, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export function ViewModeToggle({
  defaultView = "table",
  listLabel = "Cədvəl",
  gridLabel = "Kərpic",
}: {
  defaultView?: "table" | "grid";
  listLabel?: string;
  gridLabel?: string;
} = {}) {
  const router = useRouter();
  const sp = useSearchParams();
  const v = sp.get("view");
  const view = v === "grid" ? "grid" : v === "table" ? "table" : defaultView;

  const set = useCallback(
    (mode: "table" | "grid") => {
      const params = new URLSearchParams(sp.toString());
      if (mode === defaultView) params.delete("view");
      else params.set("view", mode);
      router.push(`?${params.toString()}`);
    },
    [router, sp, defaultView]
  );

  return (
    <div className="inline-flex h-9 items-center rounded-md border border-border bg-secondary/40 p-0.5">
      <button
        type="button"
        onClick={() => set("table")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition",
          view === "table"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        title={`${listLabel} görünüş`}
      >
        <Rows3 className="h-3.5 w-3.5" />
        {listLabel}
      </button>
      <button
        type="button"
        onClick={() => set("grid")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition",
          view === "grid"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        title={`${gridLabel} görünüş`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        {gridLabel}
      </button>
    </div>
  );
}
