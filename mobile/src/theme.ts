import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { colorScheme } from "nativewind";

export type Mode = "light" | "dark";

const LIGHT = {
  brand: "#0d9488", brandDark: "#0a7860", brandLight: "#ccfbf1", brand50: "#f0fdfa",
  ink: "#141820", sub: "#757a85", line: "#e5e5f0", card: "#ffffff", surface2: "#f3f3f8",
  pos: "#10b981", neg: "#ef4444", warn: "#f59e0b", info: "#3b82f6",
  ai: "#a855f7", aiDark: "#7c3aed", bg: "#f7f7fc", white: "#ffffff",
};
const DARK = {
  brand: "#14b8a6", brandDark: "#0d9488", brandLight: "#134e48", brand50: "#0b3b38",
  ink: "#eef1f8", sub: "#98a2b8", line: "#2a3346", card: "#161c2b", surface2: "#1e2638",
  pos: "#34d399", neg: "#f87171", warn: "#fbbf24", info: "#60a5fa",
  ai: "#a855f7", aiDark: "#7c3aed", bg: "#0b0f1a", white: "#ffffff",
};

// MUTABLE — inline style-larda C.x render zamanı oxunur; tema dəyişəndə Object.assign
// ilə yenilənir + _layout key={mode} ilə remount → yeni dəyərlər tətbiq olunur.
export const C = { ...LIGHT };
export function applyTheme(mode: Mode) {
  Object.assign(C, mode === "dark" ? DARK : LIGHT);
}

// Web `--brand-gradient` (emerald-teal) güzgüsü — AI banner + mərkəzi AI düyməsi bununla.
export const BRAND_GRADIENT = ["#0d9488", "#10b981", "#16c98e"] as const;
// Köhnə bənövşəyi AI tonu — yalnız geriyə-uyğunluq üçün saxlanır (artıq AI üçün istifadə olunmur).
export const AI_GRADIENT: [string, string] = ["#8b5cf6", "#a855f7"];
export const R = { sm: 6, md: 10, lg: 14, xl: 18, full: 9999 } as const;

// Semantik tonlar — rgba (light + dark hər ikisində işləyir)
export const TONE = {
  success: { bg: "rgba(16,185,129,0.15)", fg: "#10b981", solid: "#10b981" },
  warning: { bg: "rgba(245,158,11,0.16)", fg: "#f59e0b", solid: "#f59e0b" },
  danger: { bg: "rgba(239,68,68,0.15)", fg: "#ef4444", solid: "#ef4444" },
  info: { bg: "rgba(59,130,246,0.15)", fg: "#3b82f6", solid: "#3b82f6" },
  neutral: { bg: "rgba(148,163,184,0.16)", fg: "#94a3b8", solid: "#94a3b8" },
} as const;
export type ToneKey = keyof typeof TONE;

// ─── Tema store (light/dark, SecureStore-da yadda qalır) ─────────────────────
const KEY = "theme_mode";
type ThemeS = { mode: Mode; ready: boolean; load: () => Promise<void>; toggle: () => Promise<void>; set: (m: Mode) => Promise<void> };
export const useThemeStore = create<ThemeS>((set, get) => ({
  mode: "light",
  ready: false,
  load: async () => {
    let m: Mode = "light";
    try {
      const v = await SecureStore.getItemAsync(KEY);
      if (v === "dark") m = "dark";
    } catch { /* ignore */ }
    applyTheme(m);
    try { colorScheme.set(m); } catch { /* ignore */ }
    set({ mode: m, ready: true });
  },
  set: async (m) => {
    applyTheme(m);
    try { colorScheme.set(m); } catch { /* ignore */ }
    set({ mode: m });
    try { await SecureStore.setItemAsync(KEY, m); } catch { /* ignore */ }
  },
  toggle: async () => {
    const m: Mode = get().mode === "dark" ? "light" : "dark";
    await get().set(m);
  },
}));
