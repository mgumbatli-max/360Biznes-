"use client";

import { create } from "zustand";

/** Lite mobil menyu (tam-ekran modul grid-i) — açıq/bağlı vəziyyəti. */
type LiteMenuState = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

export const useLiteMenu = create<LiteMenuState>()((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
}));
