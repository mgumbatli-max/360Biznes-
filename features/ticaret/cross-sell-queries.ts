import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";
import { silentFallback } from "@/lib/safe-query";

export type CrossSellItem = {
  id: string;
  ad: string;
  kod: string | null;
  birge_say: number;
  satis_qiymeti: number;
};

/**
 * Return the top N products that are most frequently sold together with the
 * given product (by joining sales lines via the parent sifaris_id). Excludes
 * the input product itself.
 */
export async function getCrossSellSuggestions(
  mehsulId: string,
  limit = 3
): Promise<CrossSellItem[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      {
        id: string;
        ad: string;
        kod: string | null;
        birge_say: number;
        satis_qiymeti: number | null;
      }[]
    >`
      WITH base AS (
        SELECT DISTINCT sifaris_id
          FROM satis_sifaris_satirlari
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND mehsul_id   = ${mehsulId}::uuid
      )
      SELECT
        m.id::text                          AS id,
        m.ad                                AS ad,
        m.kod                               AS kod,
        COUNT(DISTINCT ss.sifaris_id)::int  AS birge_say,
        m.satis_qiymeti::float              AS satis_qiymeti
      FROM satis_sifaris_satirlari ss
      JOIN base                  b ON b.sifaris_id = ss.sifaris_id
      JOIN mehsullar             m ON m.id         = ss.mehsul_id
      WHERE ss.sahibkar_id   = ${sahibkarId}::uuid
        AND ss.mehsul_id    <> ${mehsulId}::uuid
      GROUP BY 1, 2, 3, 5
      ORDER BY birge_say DESC
      LIMIT ${limit}
    `;
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      kod: r.kod,
      birge_say: Number(r.birge_say),
      satis_qiymeti: Number(r.satis_qiymeti ?? 0) * s,
    }));
  });
}

export type CrossSellPair = {
  a_id: string;
  a_ad: string;
  b_id: string;
  b_ad: string;
  birge_say: number;
};

/**
 * Top N məhsul cütlüyü — son N gündə birgə alınmış məhsul cütləri.
 * Sahibkarın "hansı məhsullar birlikdə satılır?" sualına cavabdır.
 */
export async function getTopCrossSellPairs(days = 90, limit = 10): Promise<CrossSellPair[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await prisma.$queryRaw<CrossSellPair[]>`
      SELECT
        m1.id::text AS a_id, m1.ad AS a_ad,
        m2.id::text AS b_id, m2.ad AS b_ad,
        COUNT(DISTINCT ss1.sifaris_id)::int AS birge_say
      FROM satis_sifaris_satirlari ss1
      JOIN satis_sifaris_satirlari ss2 ON ss2.sifaris_id = ss1.sifaris_id
       AND ss2.mehsul_id > ss1.mehsul_id
      JOIN satis_sifarisleri s ON s.id = ss1.sifaris_id
      JOIN mehsullar m1 ON m1.id = ss1.mehsul_id
      JOIN mehsullar m2 ON m2.id = ss2.mehsul_id
      WHERE ss1.sahibkar_id = ${sahibkarId}::uuid
        AND s.tarix >= ${since}
        AND s.status NOT IN ('legv', 'qaralama', 'tesdiq_gozleyir')
      GROUP BY m1.id, m1.ad, m2.id, m2.ad
      HAVING COUNT(DISTINCT ss1.sifaris_id) >= 2
      ORDER BY birge_say DESC
      LIMIT ${limit}
    `.catch(silentFallback("getCrossSellSuggestions", [] as Array<{ a_id: string; a_ad: string; b_id: string; b_ad: string; birge_say: bigint; orta_mebleg: number }>));
    return rows.map((r) => ({
      a_id: r.a_id,
      a_ad: r.a_ad,
      b_id: r.b_id,
      b_ad: r.b_ad,
      birge_say: Number(r.birge_say),
    }));
  });
}
