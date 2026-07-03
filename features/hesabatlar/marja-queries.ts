import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { DateRange } from "./shared";

export type MarjaKpi = {
  revenue: number;
  cogs: number;
  margin: number;
  margin_pct: number;
  avg_margin_per_item: number;
  total_units: number;
  loss_leaders_count: number;
};

export async function getMarjaKpi(range: DateRange): Promise<MarjaKpi> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [agg, leaders] = await Promise.all([
      prisma.$queryRaw<{ revenue: number; cogs: number; units: number }[]>`
        SELECT COALESCE(SUM(sls.cemi), 0)::float AS revenue,
               COALESCE(SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)), 0)::float AS cogs,
               COALESCE(SUM(sls.miqdar), 0)::float AS units
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          JOIN mehsullar m ON m.id = sls.mehsul_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix BETWEEN ${range.from} AND ${range.to}
           AND ss.status NOT IN ('legv','qaytarilib')
           AND ss.qaralama IS NOT TRUE
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c FROM (
          SELECT sls.mehsul_id
            FROM satis_sifaris_satirlari sls
            JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
            JOIN mehsullar m ON m.id = sls.mehsul_id
           WHERE sls.sahibkar_id = ${sahibkarId}::uuid
             AND ss.tarix BETWEEN ${range.from} AND ${range.to}
             AND ss.status NOT IN ('legv','qaytarilib')
           GROUP BY sls.mehsul_id
          HAVING SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)) < 0
        ) sub
      `,
    ]);
    const a = agg[0] ?? { revenue: 0, cogs: 0, units: 0 };
    const revenue = Number(a.revenue);
    const cogs = Number(a.cogs);
    const units = Number(a.units);
    const margin = revenue - cogs;
    return {
      revenue,
      cogs,
      margin,
      margin_pct: revenue > 0 ? (margin / revenue) * 100 : 0,
      avg_margin_per_item: units > 0 ? margin / units : 0,
      total_units: units,
      loss_leaders_count: Number(leaders[0]?.c ?? 0),
    };
  });
}

export type MarjaCategory = {
  kateqoriya: string;
  units: number;
  revenue: number;
  cogs: number;
  margin: number;
  margin_pct: number;
};

export async function getMarjaByCategory(range: DateRange): Promise<MarjaCategory[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<MarjaCategory[]>`
      SELECT COALESCE(c.ad, '—') AS kateqoriya,
             SUM(sls.miqdar)::float AS units,
             SUM(sls.cemi)::float AS revenue,
             SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))::float AS cogs,
             (SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)))::float AS margin,
             CASE WHEN SUM(sls.cemi) > 0
                  THEN ((SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))) / SUM(sls.cemi) * 100)::float
                  ELSE 0 END AS margin_pct
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
        LEFT JOIN kateqoriyalar c ON c.id = m.kateqoriya_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${range.from} AND ${range.to}
         AND ss.status NOT IN ('legv','qaytarilib')
         AND ss.qaralama IS NOT TRUE
       GROUP BY c.ad
       ORDER BY margin DESC
    `;
    return rows.map((r) => ({
      ...r,
      units: Number(r.units),
      revenue: Number(r.revenue),
      cogs: Number(r.cogs),
      margin: Number(r.margin),
      margin_pct: Number(r.margin_pct),
    }));
  });
}

export type MarjaProduct = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  kateqoriya: string;
  units: number;
  revenue: number;
  cogs: number;
  margin: number;
  margin_pct: number;
};

export async function getMarjaProducts(
  range: DateRange,
  order: "best" | "worst" | "biggest" = "best",
  limit = 25
): Promise<MarjaProduct[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const orderBy =
      order === "best"
        ? "margin_pct DESC"
        : order === "worst"
        ? "margin_pct ASC"
        : "margin DESC";
    const rows = await prisma.$queryRawUnsafe<MarjaProduct[]>(
      `
      SELECT m.id::text AS mehsul_id, m.ad, m.kod, COALESCE(c.ad, '—') AS kateqoriya,
             SUM(sls.miqdar)::float AS units,
             SUM(sls.cemi)::float AS revenue,
             SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))::float AS cogs,
             (SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)))::float AS margin,
             CASE WHEN SUM(sls.cemi) > 0
                  THEN ((SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))) / SUM(sls.cemi) * 100)::float
                  ELSE 0 END AS margin_pct
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
        LEFT JOIN kateqoriyalar c ON c.id = m.kateqoriya_id
       WHERE sls.sahibkar_id = $1::uuid
         AND ss.tarix BETWEEN $2 AND $3
         AND ss.status NOT IN ('legv','qaytarilib')
         AND ss.qaralama IS NOT TRUE
       GROUP BY m.id, m.ad, m.kod, c.ad
       HAVING SUM(sls.miqdar) > 0
       ORDER BY ${orderBy}
       LIMIT $4
      `,
      sahibkarId,
      range.from,
      range.to,
      limit
    );
    return rows.map((r) => ({
      ...r,
      units: Number(r.units),
      revenue: Number(r.revenue),
      cogs: Number(r.cogs),
      margin: Number(r.margin),
      margin_pct: Number(r.margin_pct),
    }));
  });
}

export type MarjaCustomer = {
  musteri_id: string;
  ad: string;
  orders: number;
  revenue: number;
  cogs: number;
  margin: number;
  margin_pct: number;
};

export async function getMarjaByCustomer(range: DateRange, limit = 20): Promise<MarjaCustomer[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<MarjaCustomer[]>`
      SELECT k.id::text AS musteri_id, k.ad,
             COUNT(DISTINCT ss.id)::int AS orders,
             SUM(sls.cemi)::float AS revenue,
             SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))::float AS cogs,
             (SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)))::float AS margin,
             CASE WHEN SUM(sls.cemi) > 0
                  THEN ((SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))) / SUM(sls.cemi) * 100)::float
                  ELSE 0 END AS margin_pct
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
        JOIN kontragentler k ON k.id = ss.musteri_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${range.from} AND ${range.to}
         AND ss.status NOT IN ('legv','qaytarilib')
         AND ss.qaralama IS NOT TRUE
       GROUP BY k.id, k.ad
       ORDER BY margin DESC
       LIMIT ${limit}
    `;
    return rows.map((r) => ({
      ...r,
      orders: Number(r.orders),
      revenue: Number(r.revenue),
      cogs: Number(r.cogs),
      margin: Number(r.margin),
      margin_pct: Number(r.margin_pct),
    }));
  });
}

/** Margin distribution buckets — useful to understand how products spread. */
export type MarjaBucket = { bucket: string; count: number; revenue: number };

export async function getMarjaBuckets(range: DateRange): Promise<MarjaBucket[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ bucket: string; count: number; revenue: number }[]>`
      WITH per_product AS (
        SELECT sls.mehsul_id,
               SUM(sls.cemi)::float AS revenue,
               (SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)))::float AS margin,
               CASE WHEN SUM(sls.cemi) > 0
                    THEN ((SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))) / SUM(sls.cemi) * 100)::float
                    ELSE 0 END AS margin_pct
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          JOIN mehsullar m ON m.id = sls.mehsul_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix BETWEEN ${range.from} AND ${range.to}
           AND ss.status NOT IN ('legv','qaytarilib')
           AND ss.qaralama IS NOT TRUE -- (audit #16) qaralama satış digər marja kartları ilə uyğun olsun
         GROUP BY sls.mehsul_id
      )
      , bucketed AS (
        SELECT CASE
                 WHEN margin_pct < 0 THEN 'Zərərlə'
                 WHEN margin_pct < 10 THEN '0-10%'
                 WHEN margin_pct < 20 THEN '10-20%'
                 WHEN margin_pct < 30 THEN '20-30%'
                 WHEN margin_pct < 50 THEN '30-50%'
                 ELSE '50%+'
               END AS bucket,
               revenue
          FROM per_product
      )
      -- QA-CANLI-2: ORDER BY ifadəsi içində SELECT alias-ı (bucket) Postgres-də
      -- qadağandır (42703) — bucket əvvəlcə CTE sütununa çevrilir.
      SELECT bucket,
             COUNT(*)::int AS count,
             COALESCE(SUM(revenue), 0)::float AS revenue
        FROM bucketed
       GROUP BY bucket
       ORDER BY CASE bucket
         WHEN 'Zərərlə' THEN 1
         WHEN '0-10%' THEN 2
         WHEN '10-20%' THEN 3
         WHEN '20-30%' THEN 4
         WHEN '30-50%' THEN 5
         ELSE 6 END
    `;
    return rows.map((r) => ({ ...r, count: Number(r.count), revenue: Number(r.revenue) }));
  });
}
