import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type DateRange = { from: Date; to: Date };

function thisMonthRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

export async function getSalesSummary(range?: DateRange) {
  const r = range ?? thisMonthRange();
  return withTenant(async () => {
    const [totalAgg, avgSale, byPayment] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: r.from, lte: r.to }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true, endirim_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: r.from, lte: r.to }, status: { not: "legv" }, qaralama: { not: true } },
        _avg: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.groupBy({
        by: ["odenis_nov"],
        where: { tarix: { gte: r.from, lte: r.to }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
    ]);

    return {
      total_count: totalAgg._count._all,
      total_amount: Number(totalAgg._sum.son_mebleg ?? 0),
      total_discount: Number(totalAgg._sum.endirim_mebleg ?? 0),
      avg_sale: Number(avgSale._avg.son_mebleg ?? 0),
      by_payment: byPayment.map((r) => ({
        odenis_nov: r.odenis_nov ?? "negd",
        count: r._count._all,
        amount: Number(r._sum.son_mebleg ?? 0),
      })),
    };
  });
}

export async function getTopProducts(limit = 10, range?: DateRange) {
  const r = range ?? thisMonthRange();
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      { mehsul_id: string; ad: string; satilan_qty: number; cemi: number; ortalama_qiymet: number }[]
    >`
      SELECT m.id::text AS mehsul_id, m.ad,
             SUM(sls.miqdar)::float AS satilan_qty,
             SUM(sls.cemi)::float AS cemi,
             AVG(sls.vahid_qiymet)::float AS ortalama_qiymet
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${r.from} AND ${r.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY m.id, m.ad
       ORDER BY cemi DESC
       LIMIT ${limit}
    `;
    return rows;
  });
}

export async function getTopCustomers(limit = 10, range?: DateRange) {
  const r = range ?? thisMonthRange();
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      { musteri_id: string; ad: string; sifaris_say: number; cemi: number }[]
    >`
      SELECT k.id::text AS musteri_id, k.ad,
             COUNT(ss.id)::int AS sifaris_say,
             SUM(ss.son_mebleg)::float AS cemi
        FROM satis_sifarisleri ss
        JOIN kontragentler k ON k.id = ss.musteri_id
       WHERE ss.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${r.from} AND ${r.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY k.id, k.ad
       ORDER BY cemi DESC
       LIMIT ${limit}
    `;
    return rows;
  });
}

export async function getTopSalespeople(limit = 10, range?: DateRange) {
  const r = range ?? thisMonthRange();
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      { isci_id: string; ad: string; sifaris_say: number; cemi: number }[]
    >`
      SELECT u.id::text AS isci_id, u.ad_soyad AS ad,
             COUNT(ss.id)::int AS sifaris_say,
             SUM(ss.son_mebleg)::float AS cemi
        FROM satis_sifarisleri ss
        JOIN istifadeciler u ON u.id = ss.satis_meneceri_id
       WHERE ss.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${r.from} AND ${r.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY u.id, u.ad_soyad
       ORDER BY cemi DESC
       LIMIT ${limit}
    `;
    return rows;
  });
}

/** Top products with margin (sales − cost). */
export async function getMarginAnalysis(limit = 20, range?: DateRange) {
  const r = range ?? thisMonthRange();
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      { mehsul_id: string; ad: string; satilan: number; gelir: number; xerc: number; mənfeet: number; margin_faiz: number }[]
    >`
      SELECT m.id::text AS mehsul_id, m.ad,
             SUM(sls.miqdar)::float AS satilan,
             SUM(sls.cemi)::float AS gelir,
             SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))::float AS xerc,
             (SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)))::float AS "mənfeet",
             CASE WHEN SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)) > 0
                  THEN ((SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))) / SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)) * 100)::float
                  ELSE NULL END AS margin_faiz
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${r.from} AND ${r.to}
         AND ss.status != 'legv'
       GROUP BY m.id, m.ad
       ORDER BY "mənfeet" DESC NULLS LAST
       LIMIT ${limit}
    `;
    return rows;
  });
}

/** Dead stock — products with no sales in the last 60 days but with stock. */
export async function getDeadStock(limit = 20) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const rows = await prisma.$queryRaw<
      { mehsul_id: string; ad: string; kod: string | null; stok: number; deyer: number; son_satis: Date | null }[]
    >`
      SELECT m.id::text AS mehsul_id, m.ad, m.kod,
             COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0)::float AS stok,
             COALESCE((SELECT SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)) FROM stok s WHERE s.mehsul_id = m.id), 0)::float AS deyer,
             (SELECT MAX(ss.tarix)
                FROM satis_sifaris_satirlari sls
                JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
               WHERE sls.mehsul_id = m.id AND ss.status != 'legv') AS son_satis
        FROM mehsullar m
       WHERE m.sahibkar_id = ${sahibkarId}::uuid
         AND m.aktiv = TRUE
         AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) > 0
         AND NOT EXISTS (
           SELECT 1 FROM satis_sifaris_satirlari sls
            JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
            WHERE sls.mehsul_id = m.id AND ss.tarix >= ${cutoff}
              AND ss.status != 'legv'
         )
       ORDER BY deyer DESC
       LIMIT ${limit}
    `;
    return rows;
  });
}

export async function getProfitLoss(range?: DateRange) {
  const r = range ?? thisMonthRange();
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const [salesAgg, cogsAgg, expensesAgg, returnsAgg, returnsCogsAgg] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: r.from, lte: r.to }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
      }),
      // Cost of goods sold = sum of (miqdar × alish_qiymeti) for sold items
      prisma.$queryRaw<{ cogs: number }[]>`
        SELECT COALESCE(SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)), 0)::float AS cogs
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          JOIN mehsullar m ON m.id = sls.mehsul_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix BETWEEN ${r.from} AND ${r.to}
           AND ss.status != 'legv'
      `,
      // Operating expenses (xerclər table) — QA: ləğv edilmiş xərc çıxılsın (getPlSummary ilə eyni)
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(mebleg_azn), 0)::float AS total
          FROM "xerclər"
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix BETWEEN ${r.from} AND ${r.to}
           AND legv_de IS NULL
      `.catch(() => [{ total: 0 }]),
      // QA-M7: bu hesabat qaytarmanı HEÇ saymırdı (getPlSummary ilə uyğunsuz idi). Simmetrik:
      // gəlirdən qaytarma dəyəri, COGS-dan qaytarılan malın mayası çıxılsın.
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(umumi_mebleg), 0)::float AS total
          FROM qaytarma_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix BETWEEN ${r.from} AND ${r.to}
           AND status NOT IN ('legv','tesdiqlenmemis')
      `.catch(() => [{ total: 0 }]),
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(qs.miqdar * COALESCE(m.alish_qiymeti, 0)), 0)::float AS total
          FROM qaytarma_satirlari qs
          JOIN qaytarma_sifarisleri qsf ON qsf.id = qs.qaytarma_id
          JOIN mehsullar m ON m.id = qs.mehsul_id
         WHERE qsf.sahibkar_id = ${sahibkarId}::uuid
           AND qsf.tarix BETWEEN ${r.from} AND ${r.to}
           AND qsf.status NOT IN ('legv','tesdiqlenmemis')
      `.catch(() => [{ total: 0 }]),
    ]);

    const revenue = Number(salesAgg._sum.son_mebleg ?? 0);
    const returns = Number(returnsAgg[0]?.total ?? 0);
    const cogs_gross = Number(cogsAgg[0]?.cogs ?? 0);
    const returns_cogs = Number(returnsCogsAgg[0]?.total ?? 0);
    // Net COGS = satılmış malın mayası − qaytarılan malın mayası (qaytarılan stoka qayıdır).
    const cogs = Math.max(0, cogs_gross - returns_cogs);
    const opex = Number(expensesAgg[0]?.total ?? 0);
    const net_revenue = revenue - returns;
    const gross = net_revenue - cogs;
    const net = gross - opex;

    return { revenue, returns, cogs, gross_profit: gross, opex, net_profit: net, range: r };
  });
}
