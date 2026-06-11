"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type PriceRule = {
  /** Qaydanın ekran adı — məs. "Topdan", "Diler", "VIP" */
  ad: string;
  /** Markup faiz — mənfi olarsa pərakəndədən aşağıdır. Məs. -25 → 25% endirim */
  markup: number;
  /** Yuvarlaqlama: "0.99" | "0.95" | "0.50" | "0.00" */
  round_to: string;
  /** Kateqoriya spesifik və ya null = qlobal */
  kateqoriya_id: number | null;
  aktiv: boolean;
};

/**
 * Avtomatik qiymət təklifi üçün aktiv qaydaları gətir.
 * Ayarlar > Qiymət siyasəti bölməsindən. Sahibkar/admin orada redaktə edir.
 *
 * Heç bir qayda yoxdursa, default sistem qaydaları qaytarılır:
 *  - Topdan: -25% (pərakəndədən)
 *  - Diler:  -30%
 *  - VIP:    -10%
 *  - Minimum: -35%
 */
export async function getActivePriceRules(): Promise<{ rules: PriceRule[]; isDefault: boolean }> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: "qiymet_qayda" },
      orderBy: { id: "asc" },
    });
    const userRules: PriceRule[] = [];
    for (const r of rows) {
      if (!r.deyer) continue;
      try {
        const parsed = JSON.parse(r.deyer);
        if (parsed?.ad && parsed?.markup != null && parsed.aktiv !== false) {
          userRules.push({
            ad: String(parsed.ad),
            markup: Number(parsed.markup),
            round_to: String(parsed.round_to ?? "0.00"),
            kateqoriya_id: parsed.kateqoriya_id ?? null,
            aktiv: true,
          });
        }
      } catch {
        // ignore malformed
      }
    }
    if (userRules.length > 0) return { rules: userRules, isDefault: false };
    // Default sistem qaydaları — ayarlardan heç bir qayda yoxdursa
    return {
      rules: [
        // Hibrid default sxem (#7) — istifadəçi Ayarlar > Qiymət siyasətində dəyişə bilər.
        // Əvvəl topdan -25/-30/-10/-35 idi; satışdan ~-15% daha real başlanğıcdır.
        { ad: "Topdan", markup: -15, round_to: "0.00", kateqoriya_id: null, aktiv: true },
        { ad: "Diler", markup: -20, round_to: "0.00", kateqoriya_id: null, aktiv: true },
        { ad: "VIP", markup: -15, round_to: "0.00", kateqoriya_id: null, aktiv: true },
        { ad: "Minimum", markup: -25, round_to: "0.00", kateqoriya_id: null, aktiv: true },
      ],
      isDefault: true,
    };
  });
}
