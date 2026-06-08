import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Blocker } from "./types";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Bronu ləğv cəhdində bloklayan amilləri qaytarır:
 *   1. Bağlı açıq satış (əgər bron bir satışa bağlıdır)
 */
export async function findBronBlockers(
  bronId: number,
  tx: TxClient = prisma,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];
  try {
    const bron = await tx.stok_bron.findUnique({
      where: { id: bronId },
      select: { satis_id: true, mehsul_id: true, sayi: true },
    });
    if (bron?.satis_id) {
      const s = await tx.satis_sifarisleri.findUnique({
        where: { id: bron.satis_id },
        select: { id: true, nomre: true, son_mebleg: true, status: true, deleted_at: true },
      });
      if (s && !s.deleted_at && s.status !== "legv") {
        blockers.push({
          type: "satis",
          id: s.id,
          label: `${s.nomre} — ${Number(s.son_mebleg ?? 0).toFixed(2)} ₼`,
          href: `/ticaret/satislar/${s.id}`,
          amount: Number(s.son_mebleg ?? 0),
          badge: s.status ?? undefined,
        });
      }
    }
  } catch { /* skip */ }
  return blockers;
}
