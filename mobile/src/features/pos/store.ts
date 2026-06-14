import { create } from "zustand";
import type { CartLine, OdenisNov, PosProduct } from "./types";

type SelectedCustomer = { id: string; ad: string } | null;

type PosState = {
  anbarId: number | null;
  lines: CartLine[];
  musteri: SelectedCustomer;
  odenisNov: OdenisNov;
  endirimMebleg: number;

  setAnbar: (id: number) => void;
  addProduct: (p: PosProduct, qty?: number) => void;
  incQty: (mehsulId: string, delta: number) => void;
  setQty: (mehsulId: string, qty: number) => void;
  setPrice: (mehsulId: string, price: number) => void;
  removeLine: (mehsulId: string) => void;
  setMusteri: (c: SelectedCustomer) => void;
  setOdenis: (o: OdenisNov) => void;
  setEndirim: (n: number) => void;
  clear: () => void;
};

export const usePosStore = create<PosState>((set) => ({
  anbarId: null,
  lines: [],
  musteri: null,
  odenisNov: "negd",
  endirimMebleg: 0,

  setAnbar: (id) => set({ anbarId: id }),

  addProduct: (p, qty = 1) =>
    set((s) => {
      const existing = s.lines.find((l) => l.mehsul_id === p.id);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.mehsul_id === p.id ? { ...l, miqdar: l.miqdar + qty } : l,
          ),
        };
      }
      const line: CartLine = {
        mehsul_id: p.id,
        ad: p.ad,
        barkod: p.barkod,
        qiymet: p.qiymet,
        miqdar: qty,
        endirim_faiz: 0,
        stok: p.stok,
      };
      return { lines: [...s.lines, line] };
    }),

  incQty: (mehsulId, delta) =>
    set((s) => ({
      lines: s.lines
        .map((l) => (l.mehsul_id === mehsulId ? { ...l, miqdar: Math.max(0, l.miqdar + delta) } : l))
        .filter((l) => l.miqdar > 0),
    })),

  setQty: (mehsulId, qty) =>
    set((s) => ({
      lines: s.lines
        .map((l) => (l.mehsul_id === mehsulId ? { ...l, miqdar: Math.max(0, qty) } : l))
        .filter((l) => l.miqdar > 0),
    })),

  setPrice: (mehsulId, price) =>
    set((s) => ({
      lines: s.lines.map((l) => (l.mehsul_id === mehsulId ? { ...l, qiymet: Math.max(0, price) } : l)),
    })),

  removeLine: (mehsulId) =>
    set((s) => ({ lines: s.lines.filter((l) => l.mehsul_id !== mehsulId) })),

  setMusteri: (c) => set({ musteri: c }),
  setOdenis: (o) => set({ odenisNov: o }),
  setEndirim: (n) => set({ endirimMebleg: Math.max(0, n) }),

  clear: () => set({ lines: [], musteri: null, odenisNov: "negd", endirimMebleg: 0 }),
}));

// ─── Hesablama köməkçiləri ───────────────────────────────────────────────────
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100), 0);
}
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.miqdar, 0);
}
