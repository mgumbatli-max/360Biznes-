"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { refreshAuditCache } from "../auto-refresh-action";

const INTERVAL_MS = 10000;

export function AutoRefresh() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [tick, setTick] = useState(0);
  const [pending, startTransition] = useTransition();
  const lastRefresh = useRef<number>(0);

  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      lastRefresh.current = Date.now();
      // Server action audit cache tag-i invalidate edir, sonra router.refresh
      // yeni data ilə render edir. Yalnız router.refresh kifayət etmir çünki
      // `unstable_cache` tag-əsaslı invalidation gözləyir.
      startTransition(async () => {
        try {
          await refreshAuditCache();
        } catch {
          // Audit invalidation səhvi auto-refresh-i dayandırmasın
        }
        router.refresh();
        setTick((t) => t + 1);
      });
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [on, router]);

  const elapsed = on ? Math.min(10, Math.floor((Date.now() - lastRefresh.current) / 1000)) : 0;

  return (
    <button
      type="button"
      onClick={() => {
        if (!on) lastRefresh.current = Date.now();
        setOn((v) => !v);
      }}
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
            <span className={cn(
              "absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75",
              pending ? "animate-ping" : "animate-pulse",
            )} />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>
            Avto-yenilə {pending ? "·yenilənir" : `· ${tick}`}
          </span>
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
