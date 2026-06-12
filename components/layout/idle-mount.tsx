"use client";

import { useEffect, useState } from "react";

/**
 * Children-i yalnız səhifə interactive olduqdan sonra mount edir.
 * — TTI-ni (Time-to-Interactive) sürətləndirir: critical olmayan widget-lər
 *   (FAB, PWA prompt, offline indicator, pull-to-refresh) initial paint-i
 *   bloklamır.
 * — `requestIdleCallback` varsa istifadə olunur, yoxdursa 250ms setTimeout
 *   fallback işləyir.
 * — SSR-də heç nə render olunmur (placeholder yox — bu komponentlər zatən
 *   client-only-dir).
 *
 * İstifadə:
 *   <IdleMount>
 *     <QuickActionsFab />
 *     <PwaInstallPrompt />
 *   </IdleMount>
 */
export function IdleMount({
  children,
  timeoutMs = 1200,
}: {
  children: React.ReactNode;
  /** Idle callback gəlməsə bu vaxtdan sonra mount-u məcburi başlat */
  timeoutMs?: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const idle =
      typeof window !== "undefined" &&
      "requestIdleCallback" in window
        ? (window as Window & {
            requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
          }).requestIdleCallback
        : null;

    let handle: number | NodeJS.Timeout;
    if (idle) {
      handle = idle(() => { if (!cancelled) setMounted(true); }, { timeout: timeoutMs });
    } else {
      handle = setTimeout(() => { if (!cancelled) setMounted(true); }, 250);
    }
    return () => {
      cancelled = true;
      if (typeof handle === "number" && "cancelIdleCallback" in window) {
        (window as Window & { cancelIdleCallback: (h: number) => void }).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle as unknown as NodeJS.Timeout);
      }
    };
  }, [timeoutMs]);

  if (!mounted) return null;
  return <>{children}</>;
}
