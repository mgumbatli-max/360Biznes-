"use client";

import { create } from "zustand";

export type SalespersonChipOption = { id: string; ad_soyad: string };

type PosSalespersonState = {
  /** All salespeople available to choose from. */
  saticilar: SalespersonChipOption[];
  /** Currently selected salesperson id (drives the active sale's `satis_meneceri_id`). */
  salespersonId: string | null;
  /** Whether the current viewer is admin/owner — only then the chip is interactive. */
  canSwitch: boolean;
  /** Setters. */
  setSaticilar: (rows: SalespersonChipOption[]) => void;
  setSalespersonId: (id: string) => void;
  setCanSwitch: (v: boolean) => void;
  reset: () => void;
};

/**
 * Shared, in-memory POS-level state for the salesperson chip rendered in the
 * `<PosHeader />` (which lives in `app/pos/layout.tsx`) while the active-sale
 * source-of-truth lives inside `<PosClient />`. The store lets us coordinate
 * the two without re-architecting the layout.
 */
export const usePosSalesperson = create<PosSalespersonState>()((set) => ({
  saticilar: [],
  salespersonId: null,
  canSwitch: false,
  setSaticilar: (rows) => set({ saticilar: rows }),
  setSalespersonId: (id) => set({ salespersonId: id }),
  setCanSwitch: (v) => set({ canSwitch: v }),
  reset: () => set({ saticilar: [], salespersonId: null, canSwitch: false }),
}));
