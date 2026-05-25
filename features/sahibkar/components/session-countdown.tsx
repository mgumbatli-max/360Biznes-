"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, ShieldOff, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockSahibkar } from "../actions";

/**
 * Fixed session countdown — cookie deadline-dən asılı, aktivlik resetləmir.
 *
 * Sahibkar bölməsinə girəndə (PIN doğrulamasında) cookie-yə `exp` yazılır
 * (məs. now + 15 dəq). Sayğac yalnız bu deadline-a görə geri sayır;
 * naviqasiya və ya mouse aktivliyi vaxtı uzatmır — istifadəçi tələb edir
 * ki, "Umumi bölmənin vaxdı" sabit qalsın.
 *
 * - Layout re-render-də prop dəyişərsə (məs. ayarlarda TTL dəyişib yenidən
 *   PIN daxil edilib) lokal state yenilənir.
 * - Deadline-a çatanda lockSahibkar() çağırılır.
 */
export function SessionCountdown({
  expiresAt,
  ttlSec,
}: {
  expiresAt: number; // unix saniyə
  ttlSec: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [lockTriggered, setLockTriggered] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const tickId = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(tickId);
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
      title={
        isWarning
          ? "Diqqət — yaxında kilidlənəcək. PIN ilə yenidən giriş lazım olacaq."
          : "Sessiya vaxtı sabitdir. Naviqasiya vaxtı uzatmır."
      }
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
