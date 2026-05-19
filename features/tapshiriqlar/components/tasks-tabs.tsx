"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "menim", label: "Mənim" },
  { value: "yaratdigim", label: "Yaratdıqlarım" },
  { value: "hamisi", label: "Hamısı" },
] as const;

export function TasksTabs() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = sp.get("scope") ?? "menim";

  const change = useCallback(
    (v: string) => {
      const p = new URLSearchParams(sp.toString());
      p.set("scope", v);
      startTransition(() => router.push(`/tapshiriqlar?${p.toString()}`));
    },
    [sp, router]
  );

  return (
    <div className="inline-flex rounded-md border border-border bg-card/40 p-0.5">
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => change(t.value)}
          disabled={pending}
          className={cn(
            "h-8 rounded px-3 text-xs font-medium transition",
            current === t.value
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
