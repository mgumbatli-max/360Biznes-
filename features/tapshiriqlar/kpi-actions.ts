"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireTapshiriqPerm } from "./actions";

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
 * Sorğu: tək SQL GROUP BY (N+1 problemi həll olunub) — mesul + tapshiriq_iscilier
 * birləşdirilir, distinct istifadəçi üçün sayğaclar topulur.
 */
export async function calculateTaskBonus(il?: number, ay?: number, bazBonus = 50): Promise<BonusResult> {
  const perm = await requireTapshiriqPerm("tapshiriq.statistika");
  if (!perm.ok) return { ok: false, error: perm.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const now = new Date();
      const il_ = il ?? now.getFullYear();
      const ay_ = ay ?? now.getMonth() + 1;
      const periodStart = new Date(il_, ay_ - 1, 1);
      const periodEnd = new Date(il_, ay_, 1);

      // Tək sorğu: aktiv istifadəçilərin mesul + icrachi rollarına görə statistikası
      const raw = await prisma.$queryRaw<{
        istifadeci_id: string;
        ad_soyad: string;
        cemi: bigint;
        tamamlandi: bigint;
        gecikmis: bigint;
      }[]>`
        WITH user_tasks AS (
          SELECT DISTINCT u.id AS istifadeci_id, u.ad_soyad, t.id AS tapshiriq_id, t.status, t.deadline, t.tamamlandi_de
            FROM istifadeciler u
            JOIN tapshiriqlar t
              ON (t.mesul_id = u.id
                  OR t.id IN (SELECT ti.tapshiriq_id FROM tapshiriq_iscilier ti WHERE ti.istifadeci_id = u.id))
           WHERE u.sahibkar_id = ${sahibkarId}::uuid
             AND u.aktiv = TRUE
             AND t.sahibkar_id = ${sahibkarId}::uuid
             AND t.yaradildi >= ${periodStart}
             AND t.yaradildi <  ${periodEnd}
        )
        SELECT istifadeci_id::text,
               ad_soyad,
               COUNT(*)::bigint AS cemi,
               SUM(CASE WHEN status = 'tamamlandi' THEN 1 ELSE 0 END)::bigint AS tamamlandi,
               -- QA-orta: gec tamamlanan (tamamlandi_de > deadline) da gecikmiş sayılır —
               -- əvvəl yalnız hələ açıq+vaxtı keçmiş sayılırdı, gec bitirən 1.2x bonus alırdı
               SUM(CASE WHEN (status NOT IN ('tamamlandi', 'legv') AND deadline < ${now})
                          OR (status = 'tamamlandi' AND tamamlandi_de IS NOT NULL AND tamamlandi_de > deadline)
                        THEN 1 ELSE 0 END)::bigint AS gecikmis
          FROM user_tasks
         GROUP BY istifadeci_id, ad_soyad
         ORDER BY ad_soyad ASC
      `;

      const rows: TaskBonusRow[] = raw
        .filter((r) => Number(r.cemi) > 0)
        .map((r) => {
          const cemi = Number(r.cemi);
          const tamamlandi = Number(r.tamamlandi);
          const gecikmis = Number(r.gecikmis);
          const faiz = Math.round((tamamlandi / cemi) * 1000) / 10;
          const koef = gecikmis === 0 ? 1.2 : 1.0;
          const bonus = Math.round(bazBonus * (faiz / 100) * koef * 100) / 100;
          return {
            istifadeci_id: r.istifadeci_id,
            ad_soyad: r.ad_soyad,
            cemi,
            tamamlandi,
            gecikmis,
            tamamlanma_faiz: faiz,
            baz_bonus: bazBonus,
            bonus_mebleg: bonus,
          };
        });

      const total = rows.reduce((s, r) => s + r.bonus_mebleg, 0);
      revalidatePath("/tapshiriqlar/ai-analiz");
      await audit("kpi_hesab", "tapshiriq", null, {
        yeni_data: { il: il_, ay: ay_, baz_bonus: bazBonus, isci_sayi: rows.length, cemi_mebleg: Math.round(total * 100) / 100 },
      });
      return { ok: true, il: il_, ay: ay_, rows, cemi_mebleg: Math.round(total * 100) / 100 };
    } catch (e) {
      console.error("[calculateTaskBonus]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Bonus hesablanmadı: ${msg}` };
    }
  });
}
