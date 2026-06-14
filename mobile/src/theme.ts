// LIGHT tema — 360biznes.az dizayn tokenləri (globals.css light) ilə 1-1.
export const C = {
  brand: "#0d9488", // --primary (Emerald-Teal)
  brandDark: "#0a7860", // --primary-dark
  brandLight: "#ccfbf1",
  brand50: "#f0fdfa",
  ink: "#141820", // --foreground
  sub: "#757a85", // --muted-foreground
  line: "#e5e5f0", // --border
  card: "#ffffff", // --card
  surface2: "#f3f3f8", // --surface-2
  pos: "#10b981", // --success
  neg: "#ef4444", // --danger
  warn: "#f59e0b", // --warning
  info: "#3b82f6", // --info
  ai: "#a855f7", // AI / gradient aksent (bənövşəyi)
  aiDark: "#7c3aed",
  bg: "#f7f7fc", // --surface-1 (səhifə fonu)
  white: "#ffffff",
} as const;

// AI / "Süni İntellekt" üçün bənövşəyi gradient (saytdakı kimi)
export const AI_GRADIENT: [string, string] = ["#8b5cf6", "#a855f7"];
export const BRAND_GRADIENT: [string, string] = ["#0d9488", "#14b8a6"];

export const R = { sm: 6, md: 10, lg: 14, xl: 18, full: 9999 } as const;

// Semantik tonlar (KPI/ikon qutusu) — light fon (web bg-*/10 text-*-600 ekvivalenti)
export const TONE = {
  success: { bg: "#ecfdf5", fg: "#059669", solid: C.pos },
  warning: { bg: "#fffbeb", fg: "#d97706", solid: C.warn },
  danger: { bg: "#fef2f2", fg: "#dc2626", solid: C.neg },
  info: { bg: "#eff6ff", fg: "#2563eb", solid: C.info },
  neutral: { bg: "#f3f3f8", fg: "#757a85", solid: C.sub },
} as const;
export type ToneKey = keyof typeof TONE;
