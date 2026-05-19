"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, ShieldOff, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockSahibkar } from "../actions";

/**
 * Activity-aware session countdown.
 *
 * - Listens to mouse / keyboard / touch events
 * - Each interaction resets the deadline to now + `totalSec`
 * - On true idle the timer ticks down; at 0 → locks session
 * - At 30 seconds remaining a warning indicator appears
 * - Throttled so rapid events don't flood state updates
 */
export function SessionCountdown({ totalSec }: { totalSec: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [lockTriggered, setLockTriggered] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  // Qoruma: DB-də 0 və ya kiçik dəyər varsa minimum 5 dəqiqə tətbiq
  const safeTotalSec = totalSec < 300 ? 900 : totalSec;

  useEffect(() => {
    const start = Date.now();
    let currentDeadline = start + safeTotalSec * 1000;
    // Both states updated together at mount sync — not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeadline(currentDeadline);
    setNow(start);

    const tickId = setInterval(() => setNow(Date.now()), 1000);

    // Activity → push the deadline forward. Throttled to once per second
    // to avoid excessive re-renders during rapid mouse moves.
    let lastReset = 0;
    const onActivity = () => {
      const t = Date.now();
      if (t - lastReset < 1000) return;
      lastReset = t;
      currentDeadline = t + safeTotalSec * 1000;
      setDeadline(currentDeadline);
    };

    // mousemove fires very frequently, so use mousedown/move-throttled
    const events: (keyof DocumentEventMap)[] = ["mousedown", "keydown", "touchstart", "scroll", "wheel"];
    events.forEach((e) => document.addEventListener(e, onActivity, { passive: true }));

    return () => {
      clearInterval(tickId);
      events.forEach((e) => document.removeEventListener(e, onActivity));
    };
  }, [safeTotalSec]);

  const remaining = deadline != null && now != null
    ? Math.max(0, Math.floor((deadline - now) / 1000))
    : safeTotalSec;

  useEffect(() => {
    if (deadline == null || now == null) return;
    if (remaining !== 0 || lockTriggered) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLockTriggered(true);
    startTransition(async () => {
      try {
        await lockSahibkar();
      } catch {
        /* redirect throws — ignore */
      }
      router.push("/dashboard");
    });
  }, [remaining, lockTriggered, deadline, now, router]);

  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  const fmt = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  const pct = (remaining / safeTotalSec) * 100;
  const color =
    pct > 50 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
    : pct > 20 ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
    : "border-rose-500/40 bg-rose-500/10 text-rose-500";

  const isLocked = deadline != null && now != null && remaining === 0;
  const isWarning = remaining > 0 && remaining <= 30;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
        color,
        isWarning && "animate-pulse"
      )}
      title={isWarning ? "Diqqət — yaxında kilidlənəcək. Klik və ya yaz, sessiya yenilənəcək" : "Boş qalanda avto-kilid. Hər kliklə yenilənir."}
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
