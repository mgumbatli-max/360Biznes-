import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { prismaUnscoped } from "@/lib/db/prisma";
import {
  LITE_MODULES,
  type Density,
  type FontScale,
  type MobileLayout,
  type Accent,
} from "./registry";

/**
 * Lite rejimi konfiqurasiyası — per-tenant (`ayarlar` cədvəli, qrup='gorunis').
 * Server Component-lər `getLiteConfig()` ilə oxuyur; default registry-dən gəlir,
 * sahibkar saxladıqları üstünə yazılır (merge).
 */
export type LiteDesign = {
  density: Density;
  mobileLayout: MobileLayout;
  fontScale: FontScale;
  accent: Accent;
};

export type LiteModuleConfig = {
  enabled: boolean;
  blocks: Record<string, boolean>;
};

export type LiteConfig = {
  design: LiteDesign;
  modules: Record<string, LiteModuleConfig>;
};

export const DEFAULT_DESIGN: LiteDesign = {
  density: "rahat",
  mobileLayout: "kart",
  fontScale: "normal",
  accent: "rose",
};

const COOKIE_GROUP = "gorunis";
const CONFIG_KEY = "lite_config";

/** Registry-dən tam default config (sahibkar heç nə saxlamayıbsa). */
export function defaultLiteConfig(): LiteConfig {
  const modules: Record<string, LiteModuleConfig> = {};
  for (const m of LITE_MODULES) {
    const blocks: Record<string, boolean> = {};
    for (const b of m.bloklar) blocks[b.kod] = b.liteDefault;
    modules[m.kod] = { enabled: true, blocks };
  }
  return { design: { ...DEFAULT_DESIGN }, modules };
}

/** Saxlanmış (qismən) config-i default ilə birləşdir — yeni bloklar default qalır. */
function mergeConfig(def: LiteConfig, saved: Partial<LiteConfig> | null): LiteConfig {
  if (!saved || typeof saved !== "object") return def;
  const design: LiteDesign = { ...def.design, ...(saved.design ?? {}) };
  const modules: Record<string, LiteModuleConfig> = {};
  for (const [kod, defMod] of Object.entries(def.modules)) {
    const savedMod = saved.modules?.[kod];
    modules[kod] = {
      enabled: savedMod?.enabled ?? defMod.enabled,
      blocks: { ...defMod.blocks, ...(savedMod?.blocks ?? {}) },
    };
  }
  return { design, modules };
}

/**
 * Cari sahibkarın Lite config-i. `cache()` — bir render-də bir DB sorğusu.
 * Tenant-context-dən asılı olmamaq üçün sahibkar_id session-dan + prismaUnscoped.
 */
export const getLiteConfig = cache(async (): Promise<LiteConfig> => {
  const def = defaultLiteConfig();
  try {
    const session = await auth();
    const sahibkarId = session?.user?.sahibkar_id;
    if (!sahibkarId) return def;
    const row = await prismaUnscoped.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: COOKIE_GROUP, acar: CONFIG_KEY },
      select: { deyer: true },
    });
    if (!row?.deyer) return def;
    return mergeConfig(def, JSON.parse(row.deyer) as Partial<LiteConfig>);
  } catch {
    return def;
  }
});

/** Bir blokun Lite-da göstərilməsi (config + modul aktivliyi). */
export function liteBlockOn(config: LiteConfig, modul: string, blok: string): boolean {
  const m = config.modules[modul];
  if (!m || !m.enabled) return false;
  return m.blocks[blok] ?? false;
}

export { COOKIE_GROUP as LITE_CONFIG_GROUP, CONFIG_KEY as LITE_CONFIG_KEY };
