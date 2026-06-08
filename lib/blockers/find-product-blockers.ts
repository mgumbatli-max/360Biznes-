import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Blocker } from "./types";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Məhsulu silmə cəhdində bloklayan amilləri qaytarır:
 *   1. Anbarlarda qalan stok (hər anbar üçün ayrıca blocker)
 *   2. Bu məhsulla aktiv açıq satışlar (qaralama deyil, ləğv deyil)
 *   3. Bu məhsulla aktiv açıq alışlar
 */
export async function findProductBlockers(
  productId: string,
  sahibkarId: string,
  tx: TxClient = prisma,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];

  // 1) Anbar başına stok
  try {
    const stoks = await tx.stok.findMany({
      where: { mehsul_id: productId, sahibkar_id: sahibkarId, miqdar: { gt: 0 } },
      select: { anbar_id: true, miqdar: true },
      take: 15,
    });
    if (stoks.length > 0) {
      const anbarIds = stoks.map((s) => s.anbar_id).filter(Boolean) as number[];
      const anbarlar = await tx.anbarlar.findMany({
        where: { id: { in: anbarIds } },
        select: { id: true, ad: true },
      });
      const anbarMap = new Map(anbarlar.map((a) => [a.id, a.ad]));
      for (const s of stoks) {
        const ad = (s.anbar_id && anbarMap.get(s.anbar_id)) || `Anbar #${s.anbar_id}`;
        blockers.push({
          type: "stok_duzelis",
          id: `${productId}-${s.anbar_id}`,
          label: `${ad} — ${Number(s.miqdar).toFixed(2)} ədəd`,
          href: `/anbar/mehsullar/${productId}`,
          amount: Number(s.miqdar),
          badge: "stok",
        });
      }
    }
  } catch { /* skip */ }

  // 2) Aktiv açıq satışlar (bu məhsulu satan)
  try {
    const rows = await tx.$queryRaw<
      Array<{ id: string; nomre: string; son_mebleg: number; tarix: Date | null; status: string }>
    >`
      SELECT DISTINCT ss.id, ss.nomre, ss.son_mebleg::float, ss.tarix, ss.status
      FROM satis_sifaris_satirlari sl
      JOIN satis_sifarisleri ss ON ss.id = sl.sifaris_id
      WHERE sl.mehsul_id = ${productId}::uuid
        AND ss.sahibkar_id = ${sahibkarId}::uuid
        AND ss.deleted_at IS NULL
        AND ss.status NOT IN ('legv', 'qaytarilib', 'tamamlandi')
      ORDER BY ss.tarix DESC NULLS LAST
      LIMIT 8
    `;
    for (const r of rows) {
      blockers.push({
        type: "satis",
        id: r.id,
        label: `${r.nomre} — ${Number(r.son_mebleg ?? 0).toFixed(2)} ₼`,
        href: `/ticaret/satislar/${r.id}`,
        amount: Number(r.son_mebleg ?? 0),
        tarix: r.tarix ?? undefined,
        badge: r.status ?? undefined,
      });
    }
  } catch { /* skip */ }

  // 3) Aktiv açıq alışlar
  try {
    const rows = await tx.$queryRaw<
      Array<{ id: string; nomre: string; umumi_mebleg: number; tarix: Date | null; status: string }>
    >`
      SELECT DISTINCT a.id, a.nomre, a.umumi_mebleg::float, a.tarix, a.status
      FROM alis_sifaris_satirlari al
      JOIN alis_sifarisleri a ON a.id = al.sifaris_id
      WHERE al.mehsul_id = ${productId}::uuid
        AND a.sahibkar_id = ${sahibkarId}::uuid
        AND a.deleted_at IS NULL
        AND a.status NOT IN ('legv', 'qebul_edildi')
      ORDER BY a.tarix DESC NULLS LAST
      LIMIT 8
    `;
    for (const r of rows) {
      blockers.push({
        type: "alis",
        id: r.id,
        label: `${r.nomre} — ${Number(r.umumi_mebleg ?? 0).toFixed(2)} ₼`,
        href: `/ticaret/alislar/${r.id}`,
        amount: Number(r.umumi_mebleg ?? 0),
        tarix: r.tarix ?? undefined,
        badge: r.status ?? undefined,
      });
    }
  } catch { /* skip */ }

  return blockers;
}
