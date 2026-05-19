"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Columns, List, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { value: "kanban", label: "Kanban", icon: Columns },
  { value: "list", label: "Siyahı", icon: List },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
] as const;

export function ViewToggle() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = sp.get("view") ?? "list";

  const change = useCallback(
    (v: string) => {
      const p = new URLSearchParams(sp.toString());
      p.set("view", v);
      startTransition(() => router.push(`/tapshiriqlar?${p.toString()}`));
    },
    [sp, router]
  );

  return (
    <div className="inline-flex rounded-md border border-border bg-card/40 p-0.5">
      {VIEWS.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => change(t.value)}
          disabled={pending}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded px-3 text-xs font-medium transition",
            current === t.value
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <t.icon className="h-3 w-3" />
          {t.label}
        </button>
      ))}
    </div>
  );
}
