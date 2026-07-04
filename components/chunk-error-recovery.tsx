"use client";

import { useEffect } from "react";

/**
 * QA: Deploy-dan sonra "mənasız düymə" problemini həll edir.
 *
 * Next.js deploy zamanı client chunk-larının hash-ı dəyişir. İstifadəçinin tab-ı
 * köhnə manifest-lə açıq qalıbsa, client naviqasiyası (Link klik) artıq mövcud
 * olmayan chunk-ı yükləməyə çalışır → səssiz ChunkLoadError → düymə işləmir.
 *
 * Bu komponent həmin xətanı tutub səhifəni BİR DƏFƏ (loop qorumalı) təzələyir →
 * təzə chunk manifest-i yüklənir, naviqasiya bərpa olur.
 */
const CHUNK_RE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|Loading CSS chunk/i;
const GUARD_KEY = "__chunk_reload_ts";
const COOLDOWN_MS = 15000;

export function ChunkErrorRecovery() {
  useEffect(() => {
    function matches(msg: unknown): boolean {
      return typeof msg === "string" && CHUNK_RE.test(msg);
    }
    function recover(msg: unknown) {
      if (!matches(msg)) return;
      // Loop qoruması: müəyyən müddətdə yalnız bir dəfə reload (sınıq chunk təkrar gəlsə sonsuz reload olmasın)
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(GUARD_KEY) || 0);
      } catch {
        /* sessionStorage əlçatmaz — davam et */
      }
      const now = new Date().getTime();
      if (now - last < COOLDOWN_MS) return;
      try {
        sessionStorage.setItem(GUARD_KEY, String(now));
      } catch {
        /* ignore */
      }
      window.location.reload();
    }
    const onError = (e: ErrorEvent) => recover(e?.message || e?.error?.message);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e?.reason;
      recover(typeof r === "string" ? r : r?.message);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
