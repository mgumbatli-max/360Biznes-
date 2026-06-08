import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";
import type { Blocker } from "./types";

type TxClient = Prisma.TransactionClient | typeof prisma;

/**
 * Kateqoriya silmə cəhdində bloklayan amilləri qaytarır:
 *   1. Bu kateqoriyada məhsullar
 *   2. Alt-kateqoriyalar
 */
export async function findCategoryBlockers(
  categoryId: number,
  sahibkarId: string,
  tx: TxClient = prisma,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];

  // 1) Məhsullar
  try {
    const products = await tx.mehsullar.findMany({
      where: { kateqoriya_id: categoryId, sahibkar_id: sahibkarId, deleted_at: null },
      select: { id: true, ad: true, kod: true },
      take: 8,
    });
    for (const p of products) {
      blockers.push({
        type: "stok_duzelis",
        id: p.id,
        label: `${p.ad}${p.kod ? ` (${p.kod})` : ""}`,
        href: `/anbar/mehsullar/${p.id}`,
        badge: "məhsul",
      });
    }
  } catch { /* skip */ }

  // 2) Alt kateqoriyalar
  try {
    const subs = await tx.kateqoriyalar.findMany({
      where: { ust_id: categoryId },
      select: { id: true, ad: true },
      take: 8,
    });
    for (const s of subs) {
      blockers.push({
        type: "stok_duzelis",
        id: String(s.id),
        label: `Alt-kateqoriya: ${s.ad}`,
        href: `/anbar/kateqoriyalar?ust=${categoryId}`,
        badge: "kateqoriya",
      });
    }
  } catch { /* skip */ }

  return blockers;
}
