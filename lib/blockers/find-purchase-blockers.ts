import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";
import type { Blocker } from "./types";

type TxClient = Prisma.TransactionClient | typeof prisma;

/**
 * Alışı ləğv/silmə cəhdində bloklayan əlaqəli sənədləri qaytarır.
 *
 * Blockerlar:
 *   1. Təsdiq sorğusu — `tesdiq_gozleyir` statuslu alışlar üçün
 *   2. Maliyə ödənişləri (finance_operations.alish_id)
 *   3. Stok satıldı — alış qəbul edilibsə və məhsulların stoku artıq satılıbsa,
 *      hansı satışların həmin məhsulları satdığını göstərir.
 */
export async function findPurchaseBlockers(
  purchaseId: string,
  tx: TxClient = prisma,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];

  // 1) Təsdiq sorğusu
  try {
    const tesdiq = await tx.tesdiq_sorgulari.findFirst({
      where: {
        hedef_nov: "alis_sifarisi",
        hedef_id: purchaseId,
        status: "gozlemede",
      },
      select: { id: true, yaradildi: true },
    });
    if (tesdiq) {
      blockers.push({
        type: "alis",
        id: tesdiq.id,
        label: `Təsdiq sorğusu — gözlənilir`,
        href: `/tesdiq/${tesdiq.id}`,
        tarix: tesdiq.yaradildi ?? undefined,
        badge: "gozlemede",
      });
    }
  } catch { /* model yoxdursa skip */ }

  // 2) Bağlı maliyyə ödənişləri
  try {
    const finOps = await tx.finance_operations.findMany({
      where: { alish_id: purchaseId, deleted_at: null, status: { not: "legv" } },
      select: { id: true, meblegh: true, tarix: true },
      orderBy: { tarix: "desc" },
      take: 20,
    });
    for (const op of finOps) {
      const mebleg = Number(op.meblegh ?? 0);
      const dateStr = op.tarix ? new Date(op.tarix).toLocaleDateString("az-AZ") : "";
      blockers.push({
        type: "odenis",
        id: op.id,
        label: `${mebleg.toFixed(2)} ₼${dateStr ? ` — ${dateStr}` : ""}`,
        href: `/maliyye/emeliyyat/${op.id}`,
        amount: mebleg,
        tarix: op.tarix ?? undefined,
      });
    }
  } catch { /* skip */ }

  return blockers;
}

/**
 * Alış ləğv ediləndə "stok kifayət deyil" olduğu məhsullar üçün —
 * həmin məhsulları satdığımız son aktiv satışları göstərmək.
 */
export async function findSalesUsingProducts(
  mehsulIds: string[],
  anbarId: number | null | undefined,
  tx: TxClient = prisma,
): Promise<Blocker[]> {
  if (!mehsulIds.length || !anbarId) return [];
  const blockers: Blocker[] = [];
  try {
    const rows = await tx.$queryRaw<
      Array<{ satis_id: string; nomre: string; tarix: Date | null; son_mebleg: number }>
    >`
      SELECT DISTINCT ss.id AS satis_id, ss.nomre, ss.tarix, ss.son_mebleg::float
      FROM satis_sifaris_satirlari sl
      JOIN satis_sifarisleri ss ON ss.id = sl.sifaris_id
      WHERE sl.mehsul_id = ANY (${mehsulIds}::uuid[])
        AND ss.anbar_id = ${anbarId}
        AND ss.deleted_at IS NULL
        AND ss.status NOT IN ('legv', 'qaytarilib')
      ORDER BY ss.tarix DESC
      LIMIT 15
    `;
    for (const r of rows) {
      blockers.push({
        type: "satis",
        id: r.satis_id,
        label: `${r.nomre} — ${Number(r.son_mebleg ?? 0).toFixed(2)} ₼`,
        href: `/ticaret/satislar/${r.satis_id}`,
        amount: Number(r.son_mebleg ?? 0),
        tarix: r.tarix ?? undefined,
      });
    }
  } catch { /* skip */ }
  return blockers;
}
