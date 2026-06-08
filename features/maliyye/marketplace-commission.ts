import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Platform per default komissiya ayarı.
 *
 * Texniki tapşırığın tələbi: hər platforma üçün owner ayarda default
 * komissiya faizini saxlasın. Satışda manual yazılmayanda bu dəyər
 * istifadə olunsun. Hər sahibkar üçün fərqli — `ayarlar` cədvəlinin
 * `qrup="marketplace_komissiya"`, `acar=<platform_kod>` qaydası.
 */

export const PLATFORM_DEFAULTS: Record<string, number> = {
  bolt_food: 25,
  wolt: 25,
  yango_deli: 25,
  tap_az: 0,
  umico: 14,
  birmarket: 14,
  trendyol: 20,
  amazon: 15,
  noon: 15,
  progo: 10,
  diger: 0,
};

const GROUP = "marketplace_komissiya";

/** Bütün platforma komissiya faizlərini Map kimi qaytarır. */
export async function getMarketplaceCommissions(): Promise<Map<string, number>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: GROUP },
      select: { acar: true, deyer: true },
    });
    const out = new Map<string, number>();
    // Önce sistem default-larını qoy, sonra DB-dəkilərlə overrride et
    for (const [k, v] of Object.entries(PLATFORM_DEFAULTS)) {
      out.set(k, v);
    }
    for (const r of rows) {
      const v = Number(r.deyer);
      if (Number.isFinite(v) && v >= 0 && v <= 100) {
        out.set(r.acar, v);
      }
    }
    return out;
  });
}

/** Tək bir platforma üçün default komissiya. Tenant context-i lazımdır. */
export async function getDefaultCommission(platform: string): Promise<number> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: GROUP, acar: platform },
      select: { deyer: true },
    });
    if (row) {
      const v = Number(row.deyer);
      if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
    }
    return PLATFORM_DEFAULTS[platform] ?? 0;
  });
}

// setMarketplaceCommission server action ayrı fayldadır:
// `features/maliyye/marketplace-commission-actions.ts`
// — "use server" + client komponentdən çağırılmaq üçün.
