"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 70; // px — bu məsafədən sonra refresh tetiklər
const MAX_PULL = 110; // px — vizual maksimum (lastik effekti)
const RESISTANCE = 2.2; // sayı böyüt → çəkmə daha "ağır" hiss olur

/**
 * iOS/Android-stil pull-to-refresh.
 *  - Yalnız `scrollY === 0` olduqda işə düşür (yoxsa normal scroll davranışı)
 *  - Yalnız mobile-da fəaldır (md:hidden via parent)
 *  - 70px+ çəkəndə release → `router.refresh()` çağırır
 *  - Spinner: pull >= threshold-da tam çevrilmiş, çevrilmə hesabı çəkmə nisbətinə əsaslanır
 *  - Pending zamanı 8 mövqedə daimi animasiya
 *
 * Bu komponenti layout-a yerləşdirin — page-content-dən kənarda yaşaya bilər
 * (öz fixed top-0 elementidir).
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0); // hazırkı çəkmə (px, 0..MAX_PULL)
  const [isPending, startTransition] = useTransition();
  const startY = useRef<number | null>(null);
  const enabled = useRef(false);

  useEffect(() => {
    // Yalnız touch device-larda
    if (typeof window === "undefined") return;
    if (!("ontouchstart" in window)) return;

    const onTouchStart = (e: TouchEvent) => {
      // Yalnız səhifə yuxarı olduğunda
      if (window.scrollY > 0) {
        enabled.current = false;
        return;
      }
      enabled.current = true;
      startY.current = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!enabled.current || startY.current === null) return;
      const y = e.touches[0]?.clientY ?? 0;
      const delta = y - startY.current;
      if (delta <= 0) {
        // İstifadəçi yuxarı sürür → normal scroll
        setPull(0);
        return;
      }
      // Resistance: lastik effekti — sürəti azalt
      const next = Math.min(MAX_PULL, delta / RESISTANCE);
      setPull(next);
      // Browser native overscroll bounce-u söndür ki, jitter olmasın
      if (next > 4) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!enabled.current) return;
      enabled.current = false;
      startY.current = null;
      if (pull >= THRESHOLD) {
        // Threshold keçilib → refresh
        startTransition(() => {
          router.refresh();
        });
      }
      setPull(0);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull, router]);

  const progress = Math.min(1, pull / THRESHOLD);
  const visible = pull > 4 || isPending;
  const rotation = progress * 360;

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center md:hidden pt-safe"
      style={{
        // İndicator pull məsafəsinin yarısı qədər aşağı sürüşür — "drag" hissi
        transform: visible ? `translateY(${Math.max(8, pull * 0.5)}px)` : "translateY(-100%)",
        transition: pull === 0 ? "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)" : "none",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full",
          "border border-border/60 bg-card/95 shadow-lg backdrop-blur",
        )}
      >
        <RefreshCw
          className={cn(
            "h-4 w-4 text-foreground",
            isPending && "animate-spin",
          )}
          style={!isPending ? { transform: `rotate(${rotation}deg)`, transition: "none" } : undefined}
        />
      </div>
    </div>
  );
}
