import Link from "next/link";
import { cn } from "@/lib/utils";
import { LAB_CATEGORIES, type LabCategory } from "../catalog";

export type ActiveTab = LabCategory | "hamisi" | "aktiv" | "preview";

export function LabTabs({
  current,
  counts,
}: {
  current: ActiveTab;
  counts: Record<string, number>;
}) {
  return (
    <div className="-mx-2 flex flex-wrap items-center gap-1 overflow-x-auto px-2 py-1">
      {LAB_CATEGORIES.map((tab) => {
        const isActive = current === tab.id;
        const count = counts[tab.id] ?? 0;
        return (
          <Link
            key={tab.id}
            href={tab.id === "hamisi" ? "/360-lab" : `/360-lab?tab=${tab.id}`}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {tab.label}
            <span className={cn("inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] tabular-nums", isActive ? "bg-background/20" : "bg-secondary/60")}>
              {count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
