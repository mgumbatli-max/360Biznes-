import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type CashflowPeriod = "gun" | "hefte" | "ay";

export type CashflowRow = {
  bucket: string; // YYYY-MM-DD or YYYY-WW or YYYY-MM
  daxil: number;
  xaric: number;
  net: number;
};

export async function getCashflowSeries(
  period: CashflowPeriod = "gun",
  range = 30,
): Promise<CashflowRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    if (period === "gun") {
      const rows = await prisma.$queryRaw<CashflowRow[]>`
        WITH series AS (
          SELECT to_char(generate_series(
            CURRENT_DATE - (${range - 1}::int * INTERVAL '1 day'),
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date, 'YYYY-MM-DD') AS bucket
        )
        SELECT s.bucket,
               COALESCE((SELECT SUM(odenilmis)::float FROM satis_sifarisleri ss
                          WHERE ss.sahibkar_id = ${sahibkarId}::uuid
                            AND to_char(ss.tarix, 'YYYY-MM-DD') = s.bucket
                            AND ss.status != 'legv'
                            AND ss.qaralama IS NOT TRUE), 0) AS daxil,
               COALESCE((SELECT SUM(mebleg)::float FROM "xerclər" x
                          WHERE x.sahibkar_id = ${sahibkarId}::uuid
                            AND to_char(x.tarix, 'YYYY-MM-DD') = s.bucket), 0) AS xaric,
               0 AS net
          FROM series s
         ORDER BY s.bucket
      `;
      return rows.map((r) => ({ ...r, net: r.daxil - r.xaric }));
    }
    if (period === "hefte") {
      const rows = await prisma.$queryRaw<CashflowRow[]>`
        WITH series AS (
          SELECT to_char(generate_series(
            date_trunc('week', CURRENT_DATE - (${(range - 1) * 7}::int * INTERVAL '1 day')),
            date_trunc('week', CURRENT_DATE),
            INTERVAL '1 week'
          ), 'IYYY-IW') AS bucket
        )
        SELECT s.bucket,
               COALESCE((SELECT SUM(odenilmis)::float FROM satis_sifarisleri ss
                          WHERE ss.sahibkar_id = ${sahibkarId}::uuid
                            AND to_char(ss.tarix, 'IYYY-IW') = s.bucket
                            AND ss.status != 'legv'
                            AND ss.qaralama IS NOT TRUE), 0) AS daxil,
               COALESCE((SELECT SUM(mebleg)::float FROM "xerclər" x
                          WHERE x.sahibkar_id = ${sahibkarId}::uuid
                            AND to_char(x.tarix, 'IYYY-IW') = s.bucket), 0) AS xaric,
               0 AS net
          FROM series s
         ORDER BY s.bucket
      `;
      return rows.map((r) => ({ ...r, net: r.daxil - r.xaric }));
    }
    // ay
    const rows = await prisma.$queryRaw<CashflowRow[]>`
      WITH series AS (
        SELECT to_char(generate_series(
          date_trunc('month', CURRENT_DATE - (${(range - 1) * 30}::int * INTERVAL '1 day')),
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        ), 'YYYY-MM') AS bucket
      )
      SELECT s.bucket,
             COALESCE((SELECT SUM(odenilmis)::float FROM satis_sifarisleri ss
                        WHERE ss.sahibkar_id = ${sahibkarId}::uuid
                          AND to_char(ss.tarix, 'YYYY-MM') = s.bucket
                          AND ss.status != 'legv'
                          AND ss.qaralama IS NOT TRUE), 0) AS daxil,
             COALESCE((SELECT SUM(mebleg)::float FROM "xerclər" x
                        WHERE x.sahibkar_id = ${sahibkarId}::uuid
                          AND to_char(x.tarix, 'YYYY-MM') = s.bucket), 0) AS xaric,
             0 AS net
        FROM series s
       ORDER BY s.bucket
    `;
    return rows.map((r) => ({ ...r, net: r.daxil - r.xaric }));
  });
}
