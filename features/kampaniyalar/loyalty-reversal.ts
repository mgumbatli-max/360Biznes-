import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * 🔄 Satış qaytarıldıqda loyalty balını geri qaytarır (audit #8 major).
 *
 * Əvvəl qaytarmada loyalty toxunulmurdu: müştəri satışdan qazandığı balı saxlayıb
 * (al→bal qazan→qaytar = point farming), sərf etdiyi balı isə itirirdi. Bu funksiya:
 *   - qazanılan balı (nov='qazandi') geri alır (guard-lı, balans mənfi olmadan),
 *   - sərf olunan balı (nov='serf') müştəriyə geri qaytarır.
 *
 * ratio: qismən qaytarmada nisbət (0..1). İDEMPOTENT (təkrar qaytarmada işləmir).
 * BEST-EFFORT — throw etmir ki, qaytarmanın əsas nağd/stok axını bloklanmasın.
 * Qaytarma transaction-ı commit olduqdan SONRA çağırılmalıdır.
 */
export async function reverseLoyaltyForSale(satisId: string, ratio: number, returnRef?: string | null): Promise<void> {
  const r = Math.min(1, Math.max(0, ratio || 0));
  if (r <= 0 || !satisId) return;
  const refTag = returnRef ? ` #ret:${returnRef}` : "";
  try {
    await withTenant(async () => {
      const { sahibkarId } = requireTenant();
      // İdempotentlik — returnRef verilibsə həmin QAYTARMA SƏNƏDİ üçün (QA-M3/M23:
      // çoxlu hissəvi qaytarmada hər biri bir dəfə reverse olsun, yalnız birinci yox);
      // yoxsa satış səviyyəsində (legacy — məs. cancelSale tam ləğv).
      const already = await prisma.loyalty_tx.findFirst({
        where: {
          satis_id: satisId,
          nov: { in: ["qaytarma_geri", "qaytarma_serf_geri"] },
          ...(returnRef ? { qeyd: { contains: `#ret:${returnRef}` } } : {}),
        },
        select: { id: true },
      });
      if (already) return;

      const txs = await prisma.loyalty_tx.findMany({
        where: { satis_id: satisId, nov: { in: ["qazandi", "serf"] } },
        select: { kart_id: true, nov: true, mebleg: true },
      });
      if (txs.length === 0) return;

      const byCard = new Map<string, { earned: number; spent: number }>();
      for (const t of txs) {
        const g = byCard.get(t.kart_id) ?? { earned: 0, spent: 0 };
        if (t.nov === "qazandi") g.earned += Number(t.mebleg);
        else if (t.nov === "serf") g.spent += Math.abs(Number(t.mebleg));
        byCard.set(t.kart_id, g);
      }

      for (const [kartId, g] of byCard) {
        const clawback = Math.round(g.earned * r * 100) / 100; // qazanılanı geri al
        const refundPoints = Math.round(g.spent * r * 100) / 100; // sərf olunanı qaytar
        if (clawback <= 0 && refundPoints <= 0) continue;
        await prisma.$transaction(async (tx) => {
          if (clawback > 0) {
            // Guard: balans mənfi olmasın — yalnız mövcud balans qədər geri al.
            const card = await tx.loyalty_cards.findUnique({ where: { id: kartId }, select: { balans: true } });
            const take = Math.min(clawback, Number(card?.balans ?? 0));
            if (take > 0) {
              await tx.loyalty_cards.update({
                where: { id: kartId },
                data: { balans: { decrement: take }, total_qazanc: { decrement: take }, yenilendi: new Date() },
              });
              const after = await tx.loyalty_cards.findUnique({ where: { id: kartId }, select: { balans: true } });
              await tx.loyalty_tx.create({
                data: {
                  sahibkar_id: sahibkarId, kart_id: kartId, satis_id: satisId,
                  nov: "qaytarma_geri", mebleg: -take, qaliq: Number(after?.balans ?? 0),
                  qeyd: `Satış qaytarıldı — qazanılan bal geri alındı #${satisId.slice(0, 8)}${refTag}`,
                },
              });
            }
          }
          if (refundPoints > 0) {
            // QA-audit: KUMULYATİV cap — çoxlu hissəvi qaytarmada orijinal sərf olunandan çox bal geri
            // qaytarıla bilirdi (bal şişməsi). Cap = orijinal sərf − artıq geri-qaytarılmış.
            const [spentAgg, refundedAgg] = await Promise.all([
              tx.loyalty_tx.aggregate({ where: { kart_id: kartId, satis_id: satisId, nov: "serf" }, _sum: { mebleg: true } }),
              tx.loyalty_tx.aggregate({ where: { kart_id: kartId, satis_id: satisId, nov: "qaytarma_serf_geri" }, _sum: { mebleg: true } }),
            ]);
            // QA-fix: serf MƏNFİ saxlanılır (mebleg: -mebleg) → Math.abs. Əvvəl mənfi originalSpent
            // cap-ı həmişə 0 edir, refund heç işləmirdi.
            const originalSpent = Math.abs(Number(spentAgg._sum.mebleg ?? 0));
            const alreadyRefunded = Number(refundedAgg._sum.mebleg ?? 0);
            const cappedRefund = Math.max(0, Math.min(refundPoints, originalSpent - alreadyRefunded));
            if (cappedRefund > 0) {
              await tx.loyalty_cards.update({
                where: { id: kartId },
                data: { balans: { increment: cappedRefund }, total_serf: { decrement: cappedRefund }, yenilendi: new Date() },
              });
              const after = await tx.loyalty_cards.findUnique({ where: { id: kartId }, select: { balans: true } });
              await tx.loyalty_tx.create({
                data: {
                  sahibkar_id: sahibkarId, kart_id: kartId, satis_id: satisId,
                  nov: "qaytarma_serf_geri", mebleg: cappedRefund, qaliq: Number(after?.balans ?? 0),
                  qeyd: `Satış qaytarıldı — sərf olunan bal qaytarıldı #${satisId.slice(0, 8)}${refTag}`,
                },
              });
            }
          }
        });
      }
    });
  } catch (e) {
    console.warn("[reverseLoyaltyForSale]", e);
  }
}
