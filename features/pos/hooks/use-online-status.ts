"use client";

import { useEffect, useState } from "react";

/**
 * Online/offline status — browser navigator.onLine + 'online'/'offline'
 * window event-ləri ilə real-time izləyir.
 *
 * SSR-də həmişə true qaytarır (browser-da hydration zamanı real
 * qiymət ilə yenilənir).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // İlkin dəyəri al
    if (typeof navigator !== "undefined") {
      setOnline(navigator.onLine);
    }
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}
