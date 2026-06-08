import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Blocker } from "./types";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Marka (brand) deaktivləşdirmə cəhdində bloklayan amilləri qaytarır:
 *   1. Bu markanın aktiv məhsulları
 */
export async function findBrandBlockers(
  brandId: number,
  sahibkarId: string,
  tx: TxClient = prisma,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];
  try {
    const products = await tx.mehsullar.findMany({
      where: { marka_id: brandId, sahibkar_id: sahibkarId, aktiv: true, deleted_at: null },
      select: { id: true, ad: true, kod: true },
      take: 10,
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
  return blockers;
}
