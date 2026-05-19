import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type AttentionProduct = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  current_stok: number;
  min_stok: number;
  son_satis_say: number;
};

/**
 * "Diqqət lazımdır" — məhsullar ki:
 *   - bugün ən az 1 satışda iştirak edib
 *   - cari ümumi stoku `min_stok` (>0) altında düşüb
 * Sirala: ən kritik stok altda olan irəlidə.
 * Max 5 element.
 */
export async function getAttentionProducts(limit = 5): Promise<AttentionProduct[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = await prisma.$queryRaw<
      {
        mehsul_id: string;
        ad: string;
        kod: string | null;
        current_stok: number | string;
        min_stok: number | string;
        son_satis_say: number | string;
      }[]
    >(Prisma.sql`
      WITH today_sales AS (
        SELECT ss.mehsul_id, COUNT(*)::int AS satis_say
          FROM satis_sifaris_satirlari ss
          JOIN satis_sifarisleri s
            ON s.id = ss.sifaris_id
           AND s.sahibkar_id = ${sahibkarId}::uuid
           AND s.tarix >= ${today}::date
           AND COALESCE(s.qaralama, false) = false
           AND s.status <> 'legv'
         WHERE ss.sahibkar_id = ${sahibkarId}::uuid
         GROUP BY ss.mehsul_id
      ),
      stok_per_mehsul AS (
        SELECT mehsul_id, COALESCE(SUM(miqdar), 0)::float AS qty
          FROM stok
         WHERE sahibkar_id = ${sahibkarId}::uuid
         GROUP BY mehsul_id
      )
      SELECT
        m.id::text AS mehsul_id,
        m.ad,
        m.kod,
        COALESCE(spm.qty, 0)::float AS current_stok,
        COALESCE(m.min_stok, 0)::float AS min_stok,
        ts.satis_say::int AS son_satis_say
      FROM mehsullar m
      JOIN today_sales ts ON ts.mehsul_id = m.id
      LEFT JOIN stok_per_mehsul spm ON spm.mehsul_id = m.id
      WHERE m.sahibkar_id = ${sahibkarId}::uuid
        AND m.aktiv = TRUE
        AND COALESCE(m.min_stok, 0) > 0
        AND COALESCE(spm.qty, 0) < COALESCE(m.min_stok, 0)
      ORDER BY (COALESCE(m.min_stok, 0) - COALESCE(spm.qty, 0)) DESC
      LIMIT ${limit}
    `);

    return rows.map((r) => ({
      mehsul_id: r.mehsul_id,
      ad: r.ad,
      kod: r.kod,
      current_stok: Number(r.current_stok),
      min_stok: Number(r.min_stok),
      son_satis_say: Number(r.son_satis_say),
    }));
  });
}

/**
 * "Aşağı stok" — bütün məhsullar (bugün satılmasa belə) ki:
 *   - cari stok < min_stok (min_stok > 0)
 * /anbar dashboard widgetı üçün.
 */
export async function getLowStockProducts(limit = 5): Promise<AttentionProduct[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const rows = await prisma.$queryRaw<
      {
        mehsul_id: string;
        ad: string;
        kod: string | null;
        current_stok: number | string;
        min_stok: number | string;
      }[]
    >(Prisma.sql`
      WITH stok_per_mehsul AS (
        SELECT mehsul_id, COALESCE(SUM(miqdar), 0)::float AS qty
          FROM stok
         WHERE sahibkar_id = ${sahibkarId}::uuid
         GROUP BY mehsul_id
      )
      SELECT
        m.id::text AS mehsul_id,
        m.ad,
        m.kod,
        COALESCE(spm.qty, 0)::float AS current_stok,
        COALESCE(m.min_stok, 0)::float AS min_stok
      FROM mehsullar m
      LEFT JOIN stok_per_mehsul spm ON spm.mehsul_id = m.id
      WHERE m.sahibkar_id = ${sahibkarId}::uuid
        AND m.aktiv = TRUE
        AND COALESCE(m.min_stok, 0) > 0
        AND COALESCE(spm.qty, 0) < COALESCE(m.min_stok, 0)
      ORDER BY (COALESCE(m.min_stok, 0) - COALESCE(spm.qty, 0)) DESC
      LIMIT ${limit}
    `);

    return rows.map((r) => ({
      mehsul_id: r.mehsul_id,
      ad: r.ad,
      kod: r.kod,
      current_stok: Number(r.current_stok),
      min_stok: Number(r.min_stok),
      son_satis_say: 0,
    }));
  });
}
