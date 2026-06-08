"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireTicaretActionPerm } from "./access-guard";
import {
  SUPPORTED_PLATFORMS,
  type Platform,
  type PlatformDefaults,
  type MarketplaceDefaultsMap,
} from "./marketplace-platforms";

/**
 * Marketplace platforma defaultları (komissiya, bank hesabı, anbar).
 *
 * `ayarlar` cədvəlində qrup="marketplace_defaults" altında saxlanılır:
 *   acar = "<platform>.komissiya_faiz" → "15"
 *   acar = "<platform>.hesab_id"        → "<uuid>"
 *   acar = "<platform>.anbar_id"        → "1"
 *
 * Marketplace satış formada platforma seçiləndə bu defaultlar avtomatik gəlir
 * — kassir günə 200 sifariş işləyəndə komissiya əl ilə yazmasın.
 */

/** Sahibkarın bütün platforma defaultlarını oxu. */
export async function getMarketplaceDefaults(): Promise<MarketplaceDefaultsMap> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: "marketplace_defaults" },
      select: { acar: true, deyer: true },
    });

    const map: MarketplaceDefaultsMap = {};
    for (const row of rows) {
      const [platform, field] = row.acar.split(".") as [Platform, string];
      if (!SUPPORTED_PLATFORMS.includes(platform)) continue;
      const current: PlatformDefaults = map[platform] ?? {
        komissiya_faiz: 0,
        hesab_id: null,
        anbar_id: null,
      };
      if (field === "komissiya_faiz") {
        const n = Number(row.deyer);
        if (Number.isFinite(n)) current.komissiya_faiz = Math.min(100, Math.max(0, n));
      } else if (field === "hesab_id") {
        current.hesab_id = row.deyer || null;
      } else if (field === "anbar_id") {
        const n = Number(row.deyer);
        if (Number.isFinite(n) && n > 0) current.anbar_id = n;
      }
      map[platform] = current;
    }
    return map;
  });
}

const SaveSchema = z.object({
  platform: z.enum(SUPPORTED_PLATFORMS),
  komissiya_faiz: z.coerce.number().min(0).max(100),
  hesab_id: z.string().uuid().nullable(),
  anbar_id: z.coerce.number().int().positive().nullable(),
});

export type SaveMarketplaceDefaultsInput = z.input<typeof SaveSchema>;
export type SaveMarketplaceDefaultsResult =
  | { ok: true }
  | { ok: false; error: string };

/** Platforma üzrə defaultları yenilə (admin/marketplace.idare icazəsi). */
export async function saveMarketplaceDefaults(
  input: SaveMarketplaceDefaultsInput,
): Promise<SaveMarketplaceDefaultsResult> {
  const permCheck = await requireTicaretActionPerm(["marketplace.idare", "ayarlar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const entries: Array<{ acar: string; deyer: string; nov: string }> = [
        { acar: `${d.platform}.komissiya_faiz`, deyer: String(d.komissiya_faiz), nov: "number" },
        { acar: `${d.platform}.hesab_id`, deyer: d.hesab_id ?? "", nov: "uuid" },
        { acar: `${d.platform}.anbar_id`, deyer: d.anbar_id != null ? String(d.anbar_id) : "", nov: "number" },
      ];

      for (const e of entries) {
        await prisma.ayarlar.upsert({
          where: {
            sahibkar_id_qrup_acar: {
              sahibkar_id: sahibkarId,
              qrup: "marketplace_defaults",
              acar: e.acar,
            },
          },
          create: {
            sahibkar_id: sahibkarId,
            qrup: "marketplace_defaults",
            acar: e.acar,
            deyer: e.deyer,
            nov: e.nov,
            tesvir: `Marketplace platforma defaultı (${d.platform})`,
          },
          update: { deyer: e.deyer, yenilendi: new Date() },
        });
      }

      revalidatePath("/ayarlar/marketplace");
      try {
        await audit("yenile", "marketplace_defaults", d.platform, {
          yeni_data: {
            platform: d.platform,
            komissiya_faiz: d.komissiya_faiz,
            hesab_id: d.hesab_id,
            anbar_id: d.anbar_id,
          },
          sebeb: `Marketplace defaultları yeniləndi: ${d.platform}`,
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[saveMarketplaceDefaults]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Yadda saxlanmadı" };
    }
  });
}

/**
 * Sifariş kodundan platformanı təxmin et. Tam əmin deyilsə, null qaytarır.
 * Yalnız təklif məqsədli — istifadəçi seçim edə bilər.
 *
 * Pattern-lər real dünyada müşahidə olunmuş prefiksə görə tunlanmalıdır.
 */
export async function suggestPlatformFromOrderCode(code: string): Promise<Platform | null> {
  const c = code.trim().toLowerCase();
  if (!c) return null;
  // Bolt Food — adətən UUID və ya 8-12 simvol hex
  if (/^bf[-_]/.test(c) || /^bolt[-_]/.test(c)) return "bolt_food";
  // Wolt — adətən "wolt-" prefiksi və ya WLT/WO ilə başlayır
  if (/^wo[-_]/.test(c) || /^wlt[-_]/.test(c) || /^wolt[-_]/.test(c)) return "wolt";
  // Yango Deli — YD/YND
  if (/^yd[-_]/.test(c) || /^yango/.test(c)) return "yango_deli";
  // Tap.az — tap-, TAP, TZ
  if (/^tap[-_]/.test(c) || /^tz[-_]/.test(c)) return "tap_az";
  // ProGo — PG
  if (/^pg[-_]/.test(c) || /^progo/.test(c)) return "progo";
  // Birmarket — BM
  if (/^bm[-_]/.test(c) || /^birmarket/.test(c)) return "birmarket";
  // Umico — UM
  if (/^um[-_]/.test(c) || /^umico/.test(c)) return "umico";
  return null;
}
