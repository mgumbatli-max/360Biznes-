import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type QuickProductRow = {
  id: string;
  ad: string;
  kod: string | null;
  satis_qiymeti: number;
  alish_qiymeti: number;
  stok_miqdari: number;
  sold_count: number;
};

/**
 * Returns up to 10 best-selling products in the last 7 days (this week).
 * Used in POS quick-products bar.
 */
export async function getQuickProducts(
  anbarId?: number,
  limit = 10,
): Promise<QuickProductRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    // Top selling mehsul_id in this week's sales
    const rows = await prisma.$queryRaw<
      { mehsul_id: string; sold_count: number }[]
    >(Prisma.sql`
      SELECT ssr.mehsul_id::text AS mehsul_id,
             COALESCE(SUM(ssr.miqdar), 0)::float AS sold_count
        FROM satis_sifaris_satirlari ssr
        JOIN satis_sifarisleri ss ON ss.id = ssr.sifaris_id
       WHERE ss.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix >= ${since}::date
         AND ss.qaralama = false
       GROUP BY ssr.mehsul_id
       ORDER BY sold_count DESC
       LIMIT ${limit}
    `);
    if (rows.length === 0) return [];

    const products = await prisma.mehsullar.findMany({
      where: { id: { in: rows.map((r) => r.mehsul_id) }, aktiv: true },
      select: {
        id: true,
        ad: true,
        kod: true,
        satis_qiymeti: true,
        alish_qiymeti: true,
        stok: { select: { miqdar: true, anbar_id: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const result: QuickProductRow[] = [];
    for (const r of rows) {
      const p = byId.get(r.mehsul_id);
      if (!p) continue;
      const filtered = anbarId ? p.stok.filter((s) => s.anbar_id === anbarId) : p.stok;
      const stok_miqdari = filtered.reduce((s, x) => s + Number(x.miqdar ?? 0), 0);
      result.push({
        id: p.id,
        ad: p.ad,
        kod: p.kod,
        satis_qiymeti: Number(p.satis_qiymeti ?? 0),
        alish_qiymeti: Number(p.alish_qiymeti ?? 0),
        stok_miqdari,
        sold_count: r.sold_count,
      });
    }
    return result;
  });
}
