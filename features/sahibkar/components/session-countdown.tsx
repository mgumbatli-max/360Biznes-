"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Clock, ShieldOff, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockSahibkar, refreshSahibkarSession } from "../actions";

const ACTIVITY_REFRESH_INTERVAL_MS = 30_000; // sliding TTL — server-i ən çox 30 saniyədən bir yenilə

/**
 * Activity-aware session countdown with server-synced sliding TTL.
 *
 * - `expiresAt` (unix saniyə) cookie-dən gələn absolut deadline.
 * - Sayğac (expiresAt − now) əsasında işləyir; alt-səhifəyə girib çıxsa belə
 *   layout-da hosted olduğu üçün re-mount olmur, olsa belə server-prop sinxron qalır.
 * - İstifadəçi aktivliyi (mouse/keydown/touch) 30 saniyədən bir
 *   `refreshSahibkarSession` action-ını çağırır — cookie yenilənir, yeni exp
 *   client state-inə yazılır.
 * - Deadline-a çatanda lockSahibkar() çağırılır və /dashboard-a yönləndirir.
 */
export function SessionCountdown({
  expiresAt: initialExpiresAt,
  ttlSec,
}: {
  expiresAt: number; // unix saniyə
  ttlSec: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [lockTriggered, setLockTriggered] = useState(false);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [now, setNow] = useState<number | null>(null);
  const lastRefreshRef = useRef(0);

  // Server-prop dəyişəndə (layout re-render) local state-i sinxronlaşdır
  useEffect(() => {
    setExpiresAt(initialExpiresAt);
  }, [initialExpiresAt]);

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const tickId = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);

    const onActivity = () => {
      const t = Date.now();
      if (t - lastRefreshRef.current < ACTIVITY_REFRESH_INTERVAL_MS) return;
      lastRefreshRef.current = t;
      // Background-da cookie-ni yenilə, yeni exp gələndə state-i yenilə
      refreshSahibkarSession()
        .then((res) => {
          if (res?.expiresAt) setExpiresAt(res.expiresAt);
        })
        .catch(() => {
          /* silent — tick davam edir, deadline-da kilid bağlanır */
        });
    };

    const events: (keyof DocumentEventMap)[] = ["mousedown", "keydown", "touchstart", "scroll", "wheel"];
    events.forEach((e) => document.addEventListener(e, onActivity, { passive: true }));

    return () => {
      clearInterval(tickId);
      events.forEach((e) => document.removeEventListener(e, onActivity));
    };
  }, []);

  const remaining = now != null ? Math.max(0, expiresAt - now) : ttlSec;

  useEffect(() => {
    if (now == null) return;
    if (remaining !== 0 || lockTriggered) return;
    setLockTriggered(true);
    startTransition(async () => {
      try {
        await lockSahibkar();
      } catch {
        /* redirect throws — ignore */
      }
      router.push("/dashboard");
    });
  }, [remaining, lockTriggered, now, router]);

  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  const fmt = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  const pct = ttlSec > 0 ? (remaining / ttlSec) * 100 : 0;
  const color =
    pct > 50 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
    : pct > 20 ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
    : "border-rose-500/40 bg-rose-500/10 text-rose-500";

  const isLocked = now != null && remaining === 0;
  const isWarning = remaining > 0 && remaining <= 30;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
        color,
        isWarning && "animate-pulse"
      )}
      title={isWarning ? "Diqqət — yaxında kilidlənəcək. Klik və ya yaz, sessiya yenilənəcək" : "Boş qalanda avto-kilid. Aktivlik gördükdə server-də yenilənir."}
    >
      {isLocked ? (
        <ShieldOff className="h-3 w-3" />
      ) : isWarning ? (
        <MousePointer2 className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      <span className="tabular-nums">{isLocked ? "Kilidləndi…" : fmt}</span>
    </div>
  );
}
