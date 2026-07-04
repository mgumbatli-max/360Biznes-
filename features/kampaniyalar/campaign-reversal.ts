import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * 🔄 Satış TAM qaytarıldıqda/ləğv olunduqda kampaniya + kupon istifadə sayğaclarını
 * geri qaytarır (QA-M24).
 *
 * Əvvəl qaytarma/ləğv zamanı campaign_usage və coupons/campaigns.current_uses toxunulmurdu:
 *   - birdəfəlik kupon ƏBƏDİ "işlənmiş" qalırdı (müştəri qaytarsa da kuponu itirirdi),
 *   - kampaniya limitli isə (max_uses) qaytarılan satışlar limiti vaxtından əvvəl doldururdu.
 *
 * İDEMPOTENT: campaign_usage sətirləri silinir → təkrar çağırışda no-op.
 * BEST-EFFORT — throw etmir ki, qaytarmanın əsas nağd/stok axını bloklanmasın.
 * Qaytarma/ləğv transaction-ı commit olduqdan SONRA çağırılmalıdır.
 *
 * ⚠️ Kupon reverse `campaign_usage.coupon_id` sütununa bağlıdır. Sütun yaradılana qədər
 * (prod migrasiyası) yalnız kampaniya sayğacı geri qaytarılır; sütun yarananda kupon
 * reverse-i AVTOMATİK işə düşür (kod dəyişikliyi lazım deyil).
 */
export async function reverseCampaignUsageForSale(satisId: string): Promise<void> {
  if (!satisId) return;
  try {
    await withTenant(async () => {
      const { sahibkarId } = requireTenant();

      // campaign_usage sətirlərini oxu. coupon_id sütunu hələ olmaya bilər (migrasiya
      // gözlənilir) → raw SQL try/catch; alınmazsa Prisma ilə (yalnız campaign_id) fallback.
      // DİQQƏT: bu oxu tranzaksiyadan KƏNARDADIR ki, sütun-yoxdur xətası tranzaksiyanı
      // zəhərləməsin.
      let rows: Array<{ campaign_id: string | null; coupon_id: string | null }> = [];
      try {
        rows = await prisma.$queryRaw<
          Array<{ campaign_id: string | null; coupon_id: string | null }>
        >`SELECT campaign_id::text AS campaign_id, coupon_id::text AS coupon_id
            FROM campaign_usage
           WHERE satis_id = ${satisId}::uuid AND sahibkar_id = ${sahibkarId}::uuid`;
      } catch {
        const r2 = await prisma.campaign_usage.findMany({
          where: { satis_id: satisId, sahibkar_id: sahibkarId },
          select: { campaign_id: true },
        });
        rows = r2.map((x) => ({ campaign_id: x.campaign_id, coupon_id: null }));
      }
      if (rows.length === 0) return;

      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          // Kampaniya sayğacı geri (guard: 0-dan aşağı düşməsin — atomik updateMany)
          if (row.campaign_id) {
            await tx.campaigns.updateMany({
              where: { id: row.campaign_id, current_uses: { gt: 0 } },
              data: { current_uses: { decrement: 1 }, yenilendi: new Date() },
            });
          }
          // Kupon sayğacı geri (yalnız coupon_id varsa — migrasiyadan sonra)
          if (row.coupon_id) {
            await tx.coupons.updateMany({
              where: { id: row.coupon_id, current_uses: { gt: 0 } },
              data: { current_uses: { decrement: 1 } },
            });
          }
        }
        // İdempotentlik — istifadə sətirlərini sil ki, təkrar reverse ikiqat azaltmasın.
        await tx.campaign_usage.deleteMany({
          where: { satis_id: satisId, sahibkar_id: sahibkarId },
        });
      });
    });
  } catch (e) {
    console.warn("[reverseCampaignUsageForSale]", e);
  }
}
