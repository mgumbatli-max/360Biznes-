"use client";

import { create } from "zustand";

/**
 * POS Lite / Pro rejimi.
 *
 * - **Lite**: yalnız ən lazımlı funksiyalar — məhsul axtar/əlavə, miqdar, Nağd/Kart/Borc
 *   ödəniş, satışı tamamla. Telefonda satış vurmaq üçün sadə, sürətli axın.
 * - **Pro**: bütün funksiyalar — endirim, kupon, bonus, qarışıq/kreditlə/taksit ödəniş,
 *   sətir-içi qiymət/endirim, avtomatik çek/zəmanət/qaimə və s.
 *
 * Rejim `localStorage`-da saxlanır. İlk dəfə: telefon (<1024px) → Lite, masaüstü → Pro.
 * SSR/hydration uyğunsuzluğundan qaçmaq üçün ilk render həmişə deterministik (`lite`),
 * sonra `hydrate()` effekt içində həqiqi dəyəri oxuyur.
 */
export type PosMode = "lite" | "pro";

const STORAGE_KEY = "pos.mode.v1";

type PosModeState = {
  mode: PosMode;
  /** localStorage/ekran ölçüsündən oxunubmu — ilk render-də false. */
  hydrated: boolean;
  setMode: (m: PosMode) => void;
  toggle: () => void;
  /** Mount-da bir dəfə çağırılır — saxlanmış rejimi və ya cihaz default-unu yükləyir. */
  hydrate: () => void;
};

export const usePosMode = create<PosModeState>()((set, get) => ({
  mode: "lite",
  hydrated: false,
  setMode: (m) => {
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* private mode / SSR — ötür */
    }
    set({ mode: m });
  },
  toggle: () => get().setMode(get().mode === "lite" ? "pro" : "lite"),
  hydrate: () => {
    if (get().hydrated) return;
    let m: PosMode | null = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "lite" || saved === "pro") m = saved;
    } catch {
      /* ötür */
    }
    if (!m) {
      // İlk dəfə: telefon/tablet → Lite, geniş ekran → Pro
      m = typeof window !== "undefined" && window.innerWidth >= 1024 ? "pro" : "lite";
    }
    set({ mode: m, hydrated: true });
  },
}));
