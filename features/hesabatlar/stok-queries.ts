import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type AnbarStokRow = { anbar_id: number; anbar_ad: string; qty: number; value: number; mehsul_say: number };

export async function getStockByWarehouse(): Promise<AnbarStokRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<AnbarStokRow[]>`
      SELECT a.id AS anbar_id, a.ad AS anbar_ad,
             COALESCE(SUM(s.miqdar), 0)::float AS qty,
             COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0)::float AS value,
             COUNT(DISTINCT s.mehsul_id)::int AS mehsul_say
        FROM anbarlar a
        LEFT JOIN stok s ON s.anbar_id = a.id AND s.sahibkar_id = ${sahibkarId}::uuid
        LEFT JOIN mehsullar m ON m.id = s.mehsul_id
       WHERE a.sahibkar_id = ${sahibkarId}::uuid AND a.aktiv = TRUE
       GROUP BY a.id, a.ad
       ORDER BY value DESC
    `;
    return rows.map((r) => ({ ...r, qty: Number(r.qty), value: Number(r.value), mehsul_say: Number(r.mehsul_say) }));
  });
}

export type CategoryStockRow = { kateqoriya_ad: string; mehsul_say: number; qty: number; value: number };

export async function getStockByCategory(): Promise<CategoryStockRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<CategoryStockRow[]>`
      SELECT COALESCE(c.ad, '—') AS kateqoriya_ad,
             COUNT(DISTINCT m.id)::int AS mehsul_say,
             COALESCE(SUM(s.miqdar), 0)::float AS qty,
             COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0)::float AS value
        FROM mehsullar m
        LEFT JOIN kateqoriyalar c ON c.id = m.kateqoriya_id
        LEFT JOIN stok s ON s.mehsul_id = m.id
       WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
       GROUP BY c.ad
       ORDER BY value DESC
    `;
    return rows.map((r) => ({ ...r, mehsul_say: Number(r.mehsul_say), qty: Number(r.qty), value: Number(r.value) }));
  });
}

export type MovementDay = { date: string; daxil: number; xaric: number };

export async function getStockMovement30(): Promise<MovementDay[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);
    const rows = await prisma.$queryRaw<{ d: Date; daxil: number; xaric: number }[]>`
      SELECT date_trunc('day', yaradildi)::date AS d,
             SUM(CASE WHEN nov IN ('medaxil','transfer_gelis','qaytarma','duzelis_artir') THEN miqdar ELSE 0 END)::float AS daxil,
             SUM(CASE WHEN nov IN ('mexaric','satis','transfer_gediss','duzelis_azalt') THEN miqdar ELSE 0 END)::float AS xaric
        FROM anbar_hereketleri
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND yaradildi >= ${since}
       GROUP BY 1
       ORDER BY 1 ASC
    `;
    return rows.map((r) => ({
      date: r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d),
      daxil: Number(r.daxil),
      xaric: Number(r.xaric),
    }));
  });
}

export type StockAging = {
  son_30: number;
  gun_30_60: number;
  gun_60_90: number;
  yas_90_plus: number;
  olu_maya: number;
};

export async function getStockAging(): Promise<StockAging> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.$queryRaw<StockAging[]>`
      WITH son_satis AS (
        SELECT sls.mehsul_id AS mid, MAX(ss.tarix) AS son
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid AND ss.status != 'legv'
         GROUP BY sls.mehsul_id
      ),
      mehsul_stok AS (
        SELECT m.id, m.alish_qiymeti,
               COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) AS qty,
               (SELECT son FROM son_satis WHERE mid = m.id) AS son_satis
          FROM mehsullar m
         WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
      )
      SELECT
        COUNT(*) FILTER (WHERE qty > 0 AND son_satis >= CURRENT_DATE - INTERVAL '30 days')::int AS son_30,
        COUNT(*) FILTER (WHERE qty > 0 AND son_satis >= CURRENT_DATE - INTERVAL '60 days' AND son_satis < CURRENT_DATE - INTERVAL '30 days')::int AS gun_30_60,
        COUNT(*) FILTER (WHERE qty > 0 AND son_satis >= CURRENT_DATE - INTERVAL '90 days' AND son_satis < CURRENT_DATE - INTERVAL '60 days')::int AS gun_60_90,
        COUNT(*) FILTER (WHERE qty > 0 AND (son_satis IS NULL OR son_satis < CURRENT_DATE - INTERVAL '90 days'))::int AS yas_90_plus,
        COALESCE(SUM(qty * COALESCE(alish_qiymeti, 0)) FILTER (WHERE qty > 0 AND (son_satis IS NULL OR son_satis < CURRENT_DATE - INTERVAL '90 days')), 0)::float AS olu_maya
        FROM mehsul_stok
    `.catch(() => [] as StockAging[]);
    const r = row[0];
    return {
      son_30: Number(r?.son_30 ?? 0),
      gun_30_60: Number(r?.gun_30_60 ?? 0),
      gun_60_90: Number(r?.gun_60_90 ?? 0),
      yas_90_plus: Number(r?.yas_90_plus ?? 0),
      olu_maya: Number(r?.olu_maya ?? 0),
    };
  });
}

export type StockCounters = {
  total_value: number;
  total_qty: number;
  product_count: number;
  fast_count: number;
  slow_count: number;
  dead_count: number;
  reorder_count: number;
};

export async function getStockCounters(): Promise<StockCounters> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [totalRow, fastRow, slowRow, deadRow, reorderRow] = await Promise.all([
      prisma.$queryRaw<{ value: number; qty: number; cnt: number }[]>`
        SELECT COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0)::float AS value,
               COALESCE(SUM(s.miqdar), 0)::float AS qty,
               COUNT(DISTINCT m.id)::int AS cnt
          FROM stok s JOIN mehsullar m ON m.id = s.mehsul_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(DISTINCT m.id)::bigint AS c
          FROM mehsullar m
         WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
           AND EXISTS (
             SELECT 1 FROM satis_sifaris_satirlari sls
               JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
              WHERE sls.mehsul_id = m.id
                AND ss.tarix >= CURRENT_DATE - INTERVAL '30 days'
                AND ss.status != 'legv'
           )
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(DISTINCT m.id)::bigint AS c
          FROM mehsullar m
         WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
           AND EXISTS (
             SELECT 1 FROM satis_sifaris_satirlari sls
               JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
              WHERE sls.mehsul_id = m.id AND ss.status != 'legv'
                AND ss.tarix >= CURRENT_DATE - INTERVAL '90 days'
                AND ss.tarix < CURRENT_DATE - INTERVAL '30 days'
           )
           AND NOT EXISTS (
             SELECT 1 FROM satis_sifaris_satirlari sls
               JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
              WHERE sls.mehsul_id = m.id
                AND ss.tarix >= CURRENT_DATE - INTERVAL '30 days'
                AND ss.status != 'legv'
           )
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(DISTINCT m.id)::bigint AS c
          FROM mehsullar m
         WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
           AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) > 0
           AND NOT EXISTS (
             SELECT 1 FROM satis_sifaris_satirlari sls
               JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
              WHERE sls.mehsul_id = m.id
                AND ss.tarix >= CURRENT_DATE - INTERVAL '90 days'
                AND ss.status != 'legv'
           )
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c
          FROM mehsullar m
         WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
           AND COALESCE(m.min_stok, 0) > 0
           AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) <= COALESCE(m.min_stok, 0)
      `,
    ]);
    return {
      total_value: Number(totalRow[0]?.value ?? 0),
      total_qty: Number(totalRow[0]?.qty ?? 0),
      product_count: Number(totalRow[0]?.cnt ?? 0),
      fast_count: Number(fastRow[0]?.c ?? 0),
      slow_count: Number(slowRow[0]?.c ?? 0),
      dead_count: Number(deadRow[0]?.c ?? 0),
      reorder_count: Number(reorderRow[0]?.c ?? 0),
    };
  });
}
