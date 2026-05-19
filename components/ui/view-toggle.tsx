"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Table } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "card" | "list" | "table";

type Props = {
  modes?: ViewMode[];
  paramName?: string;
  defaultMode?: ViewMode;
  size?: "sm" | "md";
};

export function ViewToggle({
  modes = ["card", "list"],
  paramName = "view",
  defaultMode = "card",
  size = "md",
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const current = (sp.get(paramName) as ViewMode) || defaultMode;

  function set(mode: ViewMode) {
    const params = new URLSearchParams(sp.toString());
    if (mode === defaultMode) params.delete(paramName);
    else params.set(paramName, mode);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  const icons = {
    card: LayoutGrid,
    list: List,
    table: Table,
  };

  const labels = {
    card: "Kart görünüşü",
    list: "Siyahı görünüşü",
    table: "Cədvəl görünüşü",
  };

  const isSm = size === "sm";

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border/40 bg-secondary/40 p-0.5",
        isSm ? "h-7" : "h-9"
      )}
    >
      {modes.map((mode) => {
        const Icon = icons[mode];
        const active = current === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => set(mode)}
            title={labels[mode]}
            aria-label={labels[mode]}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center justify-center rounded-md px-2 transition",
              isSm ? "h-6" : "h-8",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn(isSm ? "h-3.5 w-3.5" : "h-4 w-4")} />
          </button>
        );
      })}
    </div>
  );
}
