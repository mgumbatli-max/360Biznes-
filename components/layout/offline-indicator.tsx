"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Qlobal offline indicator — navigator.onLine vəziyyətini izləyir.
 * Offline olduqda sticky top-də incə banner göstərir.
 * Mobile-da daha vacib (flaky conn), desktop-da da işləyir.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // SSR/ilk hydration-da render etmə (SSR-də navigator yox)
  if (!hydrated || online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 pt-safe",
        "bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-amber-950 shadow-md",
        "animate-fade-in",
      )}
    >
      <WifiOff className="h-3.5 w-3.5" />
      <span>İnternet bağlantısı yoxdur — yerli rejimdə işləyirik</span>
    </div>
  );
}
