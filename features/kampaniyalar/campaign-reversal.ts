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
 * Kupon reverse `campaign_usage.kupon_kod` (mövcud sütun) → `coupons.kod` üzərindən edilir
 * (əlavə migrasiya lazım deyil). İDEMPOTENT: campaign_usage sətirləri silinir → təkrar çağırışda no-op.
 * BEST-EFFORT — throw etmir ki, qaytarmanın əsas nağd/stok axını bloklanmasın.
 * Qaytarma/ləğv transaction-ı commit olduqdan SONRA çağırılmalıdır.
 */
export async function reverseCampaignUsageForSale(satisId: string): Promise<void> {
  if (!satisId) return;
  try {
    await withTenant(async () => {
      const { sahibkarId } = requireTenant();
      const rows = await prisma.campaign_usage.findMany({
        where: { satis_id: satisId, sahibkar_id: sahibkarId },
        select: { campaign_id: true, kupon_kod: true },
      });
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
          // Kupon sayğacı geri — kupon_kod → coupons.kod (+sahibkar) üzərindən
          if (row.kupon_kod) {
            await tx.coupons.updateMany({
              where: { kod: row.kupon_kod, sahibkar_id: sahibkarId, current_uses: { gt: 0 } },
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
