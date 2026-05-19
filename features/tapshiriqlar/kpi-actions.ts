"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type TaskBonusRow = {
  istifadeci_id: string;
  ad_soyad: string;
  cemi: number;
  tamamlandi: number;
  gecikmis: number;
  tamamlanma_faiz: number;
  baz_bonus: number;
  bonus_mebleg: number;
};

type BonusResult =
  | { ok: true; il: number; ay: number; rows: TaskBonusRow[]; cemi_mebleg: number }
  | { ok: false; error: string };

/**
 * Aylıq tapşırıq əsaslı bonus hesablanması (preview).
 * Formula: baz_bonus * (tamamlanma_faiz / 100) * (gecikmə_yoxdursa 1.2 əmsalı)
 * Default baz_bonus = 50 AZN — istifadəçi `kpi_qaydalari`-da custom bonus yığa bilər (gələcəkdə).
 *
 * Bu funksiya `calculateTaskBonus(il, ay)` adlanır və `kpi_aylik_hesablamalar`-a yazmır —
 * yalnız preview qaytarır. Yazma üçün `applyTaskBonus(...)` ayrıca çağırılır.
 */
export async function calculateTaskBonus(il?: number, ay?: number, bazBonus = 50): Promise<BonusResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const now = new Date();
      const il_ = il ?? now.getFullYear();
      const ay_ = ay ?? now.getMonth() + 1;
      const periodStart = new Date(il_, ay_ - 1, 1);
      const periodEnd = new Date(il_, ay_, 1);

      const users = await prisma.istifadeciler.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true, ad_soyad: true },
        orderBy: { ad_soyad: "asc" },
      });

      const rows: TaskBonusRow[] = [];

      for (const u of users) {
        const baseWhere = {
          sahibkar_id: sahibkarId,
          OR: [
            { mesul_id: u.id },
            { tapshiriq_iscilier: { some: { istifadeci_id: u.id } } },
          ],
          yaradildi: { gte: periodStart, lt: periodEnd },
        };

        const [cemi, tamamlandi, gecikmis] = await Promise.all([
          prisma.tapshiriqlar.count({ where: baseWhere }),
          prisma.tapshiriqlar.count({ where: { ...baseWhere, status: "tamamlandi" } }),
          prisma.tapshiriqlar.count({
            where: {
              ...baseWhere,
              deadline: { lt: now },
              status: { notIn: ["tamamlandi", "legv"] },
            },
          }),
        ]);

        if (cemi === 0) continue;
        const faiz = Math.round((tamamlandi / cemi) * 1000) / 10;
        const koef = gecikmis === 0 ? 1.2 : 1.0;
        const bonus = Math.round(bazBonus * (faiz / 100) * koef * 100) / 100;

        rows.push({
          istifadeci_id: u.id,
          ad_soyad: u.ad_soyad,
          cemi,
          tamamlandi,
          gecikmis,
          tamamlanma_faiz: faiz,
          baz_bonus: bazBonus,
          bonus_mebleg: bonus,
        });
      }

      const total = rows.reduce((s, r) => s + r.bonus_mebleg, 0);
      revalidatePath("/tapshiriqlar/ai-analiz");
      return { ok: true, il: il_, ay: ay_, rows, cemi_mebleg: Math.round(total * 100) / 100 };
    } catch (e) {
      console.error("[calculateTaskBonus]", e);
      return { ok: false, error: "Bonus hesablanmadı" };
    }
  });
}
