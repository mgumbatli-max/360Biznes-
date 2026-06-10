"use client";

import { create } from "zustand";

/**
 * Qlobal Lite / Pro rejimi (client tərəf) — `lib/app-mode.ts` ilə eyni cookie.
 *
 * Client komponentlər (POS, Topbar toggle) bunu oxuyur. Rejim `app-mode`
 * cookie-sində saxlanır ki, SERVER də (getAppMode) eyni dəyəri görsün.
 * `setMode` cookie-ni yazır — sonra `router.refresh()` çağırılmalıdır ki,
 * server-render olunan səhifələr (dashboard və s.) yeni rejimə görə yenilənsin.
 */
export type AppMode = "lite" | "pro";

const COOKIE = "app-mode";

function readCookie(): AppMode | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)app-mode=(lite|pro)/);
  return m ? (m[1] as AppMode) : null;
}

function writeCookie(mode: AppMode) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

type AppModeState = {
  mode: AppMode;
  hydrated: boolean;
  /** Cookie-ni yazır + state-i yeniləyir. router.refresh() ayrıca çağırılmalı. */
  setMode: (mode: AppMode) => void;
  toggle: () => AppMode;
  /** Mount-da bir dəfə — cookie/serverMode/cihazdan həqiqi rejimi oxuyur. */
  hydrate: (serverMode?: AppMode) => void;
};

export const useAppMode = create<AppModeState>()((set, get) => ({
  mode: "pro", // SSR deterministik default; hydrate düzəldir
  hydrated: false,
  setMode: (mode) => {
    writeCookie(mode);
    set({ mode });
  },
  toggle: () => {
    const next = get().mode === "lite" ? "pro" : "lite";
    writeCookie(next);
    set({ mode: next });
    return next;
  },
  hydrate: (serverMode) => {
    if (get().hydrated) return;
    const cookie = readCookie();
    const m: AppMode =
      cookie ??
      serverMode ??
      (typeof window !== "undefined" && window.innerWidth < 1024 ? "lite" : "pro");
    if (!cookie) writeCookie(m);
    set({ mode: m, hydrated: true });
  },
}));
