import type { AppMode } from "./app-mode-store";
import type { LiteConfig } from "../features/app-config/types";

/**
 * Modul mobil naviqasiyada görünürmü.
 * Pro → həmişə true. Lite → `visible !== false` (dashboard həmişə true).
 */
export function moduleVisible(
  cfg: LiteConfig | undefined,
  mode: AppMode,
  kod: string,
): boolean {
  if (mode !== "lite") return true;
  if (kod === "dashboard") return true;
  return cfg?.modules?.[kod]?.visible !== false;
}

/**
 * Funksiya/blok aktivdir.
 * Pro → həmişə true. Lite → modul `enabled=false` isə hamısı görünür,
 * əks halda blok config-inə görə.
 */
export function blockOn(
  cfg: LiteConfig | undefined,
  mode: AppMode,
  modul: string,
  blok: string,
): boolean {
  if (mode !== "lite") return true;
  const m = cfg?.modules?.[modul];
  if (!m) return true;
  if (!m.enabled) return true;
  return m.blocks?.[blok] ?? false;
}
