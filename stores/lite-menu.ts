"use client";

import { create } from "zustand";

/** Lite mobil menyu (tam-ekran modul grid-i) — açıq/bağlı vəziyyəti. */
type LiteMenuState = {
  open: boolean;
  setOpen: (v: boolean) => void;
  /** Lite-da gizlədilmiş modullar (registry kodları) — Pro-da boş. */
  hiddenModules: string[];
  setHiddenModules: (v: string[]) => void;
};

export const useLiteMenu = create<LiteMenuState>()((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  hiddenModules: [],
  setHiddenModules: (v) => set({ hiddenModules: v }),
}));
