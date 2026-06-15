import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { auth } from "@/auth";
import { getAppMode } from "@/lib/app-mode";
import { prismaUnscoped } from "@/lib/db/prisma";
import {
  LITE_MODULES,
  MODULE_LANDINGS,
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
  /** Lite-da naviqasiyada görünsün/görünməsin. Default true. Pro-da nəzərə alınmır. */
  visible: boolean;
  enabled: boolean;
  blocks: Record<string, boolean>;
  /** İcmal bağlı olanda modulun açıldığı səhifə (MODULE_LANDINGS-dən). */
  landing?: string;
};

export type LiteConfig = {
  design: LiteDesign;
  modules: Record<string, LiteModuleConfig>;
};

export const DEFAULT_DESIGN: LiteDesign = {
  density: "rahat",
  mobileLayout: "kart",
  fontScale: "normal",
  accent: "emerald",
};

const COOKIE_GROUP = "gorunis";
const CONFIG_KEY = "lite_config";

/** Registry-dən tam default config (sahibkar heç nə saxlamayıbsa). */
export function defaultLiteConfig(): LiteConfig {
  const modules: Record<string, LiteModuleConfig> = {};
  for (const m of LITE_MODULES) {
    const blocks: Record<string, boolean> = {};
    for (const b of m.bloklar) blocks[b.kod] = b.liteDefault;
    modules[m.kod] = {
      visible: true,
      enabled: true,
      blocks,
      landing: MODULE_LANDINGS[m.kod]?.[0]?.href,
    };
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
    const allowedLandings = (MODULE_LANDINGS[kod] ?? []).map((l) => l.href);
    modules[kod] = {
      visible: kod === "dashboard" ? true : (savedMod?.visible ?? defMod.visible),
      enabled: savedMod?.enabled ?? defMod.enabled,
      blocks: { ...defMod.blocks, ...(savedMod?.blocks ?? {}) },
      landing:
        savedMod?.landing && allowedLandings.includes(savedMod.landing)
          ? savedMod.landing
          : defMod.landing,
    };
  }
  return { design, modules };
}

/**
 * Cari sahibkarın Lite config-i. `cache()` — bir render-də bir DB sorğusu.
 * Tenant-context-dən asılı olmamaq üçün sahibkar_id session-dan + prismaUnscoped.
 */
/**
 * Verilmiş sahibkar üçün Lite config — session/tenant-context-dən asılı deyil.
 * Web (`getLiteConfig`, auth()) və mobil (`/app-config`, token tenant-context)
 * bunu paylaşır. Eyni `unstable_cache` açarı/tag-i → web nəticəsi 1:1.
 */
export async function getLiteConfigForTenant(sahibkarId: string): Promise<LiteConfig> {
  const def = defaultLiteConfig();
  try {
    // SÜRƏT: config nadir dəyişir, amma hər səhifədə (layout) oxunur. Cross-request
    // unstable_cache hər naviqasiyada 1 DB round-trip-i aradan qaldırır (prod-da Neon
    // latency × hər səhifə). saveLiteConfig revalidateTag(`lite-config:<id>`) çağırır.
    const readDeyer = unstable_cache(
      async () => {
        const row = await prismaUnscoped.ayarlar.findFirst({
          where: { sahibkar_id: sahibkarId, qrup: COOKIE_GROUP, acar: CONFIG_KEY },
          select: { deyer: true },
        });
        return row?.deyer ?? null;
      },
      ["lite-config", sahibkarId],
      { revalidate: 300, tags: [`lite-config:${sahibkarId}`] },
    );
    const deyer = await readDeyer();
    if (!deyer) return def;
    return mergeConfig(def, JSON.parse(deyer) as Partial<LiteConfig>);
  } catch {
    return def;
  }
}

/**
 * Cari sahibkarın Lite config-i (web — session-dan sahibkar_id). `cache()` —
 * bir render-də bir DB sorğusu. Nüvə `getLiteConfigForTenant`-dadır.
 */
export const getLiteConfig = cache(async (): Promise<LiteConfig> => {
  try {
    const session = await auth();
    const sahibkarId = session?.user?.sahibkar_id;
    if (!sahibkarId) return defaultLiteConfig();
    return await getLiteConfigForTenant(sahibkarId);
  } catch {
    return defaultLiteConfig();
  }
});

/** saveLiteConfig sonrası cache-i dərhal təzələmək üçün (tag adı tək mənbədən). */
export function liteConfigCacheTag(sahibkarId: string): string {
  return `lite-config:${sahibkarId}`;
}

/**
 * Bir blokun Lite-da göstərilməsi.
 * `enabled=false` = "bu modulu Lite-da sadələşdirmə" → BÜTÜN bloklar göstərilir
 * (Pro kimi, boş səhifə riski yoxdur). `enabled=true` = blok config-inə görə.
 */
export function liteBlockOn(config: LiteConfig, modul: string, blok: string): boolean {
  const m = config.modules[modul];
  if (!m) return true;
  if (!m.enabled) return true; // sadələşdirilməyən modul tam görünür
  return m.blocks[blok] ?? false;
}

/** Lite-da modul naviqasiyada görünürmü (dashboard həmişə true). Pro üçün çağıran gate yoxlayır. */
export function liteModuleVisible(config: LiteConfig, modul: string): boolean {
  if (modul === "dashboard") return true;
  return config.modules[modul]?.visible !== false;
}

/** Lite-da gizlədilmiş modul kodları (dashboard heç vaxt daxil deyil). */
export function hiddenLiteModules(config: LiteConfig): string[] {
  return Object.entries(config.modules)
    .filter(([kod, m]) => kod !== "dashboard" && m.visible === false)
    .map(([kod]) => kod);
}

/** Server gate: Pro → həmişə true; Lite → liteModuleVisible. */
export async function moduleVisibleGate(modul: string): Promise<boolean> {
  const mode = await getAppMode();
  if (mode !== "lite") return true;
  return liteModuleVisible(await getLiteConfig(), modul);
}

/**
 * Səhifə üçün blok-gate funksiyası. Pro-da həmişə `true` (config nəzərə alınmır),
 * Lite-da config-ə görə. İstifadə (Server Component):
 *   const on = await liteGate("ticaret");
 *   {on("ozet") && <Ozet/>}
 */
export async function liteGate(modul: string): Promise<(blok: string) => boolean> {
  const mode = await getAppMode();
  if (mode !== "lite") return () => true;
  const cfg = await getLiteConfig();
  return (blok: string) => liteBlockOn(cfg, modul, blok);
}

export { COOKIE_GROUP as LITE_CONFIG_GROUP, CONFIG_KEY as LITE_CONFIG_KEY };

/**
 * Modul girişi — HƏR İKİ rejimdə (Lite və Pro) işləyir.
 * İcmal (modulun öz dashboardu) görünür YALNIZ:
 *   1) Ayarlarda "Modulun öz dashboardu" bloku AÇIQdırsa, VƏ
 *   2) Rolda icazə varsa (`icmal.<modul>`); sahibkar/admin/direktor bypass.
 * Bağlıdırsa modul `landing` səhifəsinə (ayarlardan seçilir) açılır.
 */
export async function getModuleEntry(
  modul: string,
): Promise<{ icmalOn: boolean; landing: string }> {
  const cfg = await getLiteConfig();
  const m = cfg.modules[modul];
  const landing = m?.landing ?? MODULE_LANDINGS[modul]?.[0]?.href ?? "/dashboard";
  if (m?.blocks?.dashboard !== true) return { icmalOn: false, landing };

  const session = await auth();
  const rolAd = ((session?.user as { rol_ad?: string } | undefined)?.rol_ad ?? "").toLowerCase();
  const privileged =
    rolAd.includes("sahibkar") || rolAd.includes("admin") ||
    rolAd.includes("owner") || rolAd.includes("direktor");
  if (privileged) return { icmalOn: true, landing };

  const { getRequestPermissions } = await import("@/lib/auth/get-permissions");
  const icazeler = await getRequestPermissions();
  return { icmalOn: icazeler.includes(`icmal.${modul}`), landing };
}
