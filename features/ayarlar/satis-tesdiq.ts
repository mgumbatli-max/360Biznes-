import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";

/**
 * Discount approval thresholds. Stored in `ayarlar` (qrup="ticaret").
 * Defaults model international ERP discount tiers:
 *   < free_max         => sərbəst (any seller)
 *   free_max..medium   => sales.discount_medium permission
 *   medium..high       => sales.discount_high permission + approval
 *   high..admin        => admin only
 */
const QRUP = "ticaret";

export type DiscountThresholds = {
  free_max: number;       // default 5
  medium_max: number;     // default 15
  high_max: number;       // default 30
  admin_max: number;      // default 100
};

const DEFAULTS: DiscountThresholds = {
  free_max: 5,
  medium_max: 15,
  high_max: 30,
  admin_max: 100,
};

const KEYS: Record<keyof DiscountThresholds, string> = {
  free_max: "discount_threshold_free",
  medium_max: "discount_threshold_medium",
  high_max: "discount_threshold_high",
  admin_max: "discount_threshold_admin",
};

export async function getDiscountThresholds(): Promise<DiscountThresholds> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: {
        sahibkar_id: sahibkarId,
        qrup: QRUP,
        acar: { in: Object.values(KEYS) },
      },
    });
    const result: DiscountThresholds = { ...DEFAULTS };
    for (const row of rows) {
      for (const [k, key] of Object.entries(KEYS) as [keyof DiscountThresholds, string][]) {
        if (row.acar === key && row.deyer != null) {
          const n = Number(row.deyer);
          if (Number.isFinite(n)) result[k] = Math.min(100, Math.max(0, n));
        }
      }
    }
    return result;
  });
}

export async function setDiscountThresholds(t: DiscountThresholds): Promise<void> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    // Köhnə dəyərləri al — audit üçün diff
    const before = await getDiscountThresholds();
    for (const [k, key] of Object.entries(KEYS) as [keyof DiscountThresholds, string][]) {
      await prisma.ayarlar.upsert({
        where: {
          sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: key },
        },
        update: { deyer: String(t[k]), yenilendi: new Date(), nov: "number" },
        create: {
          sahibkar_id: sahibkarId,
          qrup: QRUP,
          acar: key,
          deyer: String(t[k]),
          nov: "number",
          tesvir: `Endirim threshold (${k})`,
        },
      });
    }
    // 🔒 Təsdiq threshold-ları dəyişəndə kritik audit
    try {
      await audit("yenile", "discount_threshold", null, {
        evvelki_data: before as unknown as Record<string, unknown>,
        yeni_data: t as unknown as Record<string, unknown>,
        sebeb: "Endirim təsdiq threshold-ları yeniləndi",
      });
    } catch { /* non-fatal */ }
  });
}
