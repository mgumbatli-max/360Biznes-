"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { List, LayoutGrid } from "lucide-react";

export function ViewToggle({ current }: { current: "list" | "kanban" }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setView(view: "list" | "kanban") {
    const next = new URLSearchParams(sp);
    if (view === "kanban") next.set("view", "kanban");
    else next.delete("view");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <div className="inline-flex rounded-md border border-border bg-card/40 p-0.5">
      <button
        type="button"
        onClick={() => setView("list")}
        className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs ${
          current === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <List className="h-3 w-3" /> Cədvəl
      </button>
      <button
        type="button"
        onClick={() => setView("kanban")}
        className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs ${
          current === "kanban" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutGrid className="h-3 w-3" /> Kanban
      </button>
    </div>
  );
}
