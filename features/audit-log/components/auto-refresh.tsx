"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 10000;

export function AutoRefresh() {
  const router = useRouter();
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => router.refresh(), INTERVAL_MS);
    return () => clearInterval(id);
  }, [on, router]);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      title={on ? "Avto-yenilənmə aktiv — söndürmək üçün klikləyin" : "Səhifəni hər 10 saniyədə avtomatik yeniləyir"}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition",
        on
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {on ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>Avto-yenilə · 10 sn</span>
          <Pause className="h-3 w-3" />
        </>
      ) : (
        <>
          <RefreshCw className="h-3 w-3" />
          <span>Avto-yenilə</span>
        </>
      )}
    </button>
  );
}
