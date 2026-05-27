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

export type ForecastBucket = {
  bucket: string;            // YYYY-MM-DD haftəlik bucket başı
  expected_in: number;       // gözlənilən müştəri ödənişləri (alacaq → 30 gün payment terminə görə)
  recurring_out: number;     // planlaşdırılmış aylıq xərclər (maaş bordrosu, abune)
  supplier_out: number;      // təchizatçı borcumuz (borc → 30 gün payment terminə görə)
  net: number;               // expected_in − (recurring_out + supplier_out)
};

/**
 * Pul axını proqnozu — növbəti N gün üçün gözlənilən nəğd hərəkəti.
 *
 * Sadə model (gələcəkdə zənginləşdirə bilərik):
 *  - **Daxil:** kontragentler.alacaq cəmi N gün ərzində eyni paylanır
 *    (yenilendi tarixini "borc başlama" kimi götürüb 30 günlük ödəniş termini
 *    fərz edirik).
 *  - **Xaric (recurring):** istifadeciler.aylik_maas cəmi — ayda bir gün
 *    (sadəlik üçün ayın 1-i) düşür.
 *  - **Xaric (təchizatçı):** kontragentler.borc cəmi 30 gün ərzində eyni paylanır.
 *
 * Bucket: həftəlik (7 gün), ona görə range 30/60/90 → 4-5-13 bucket.
 */
export async function getCashFlowForecast(days: number = 30): Promise<ForecastBucket[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    // 1. Aggregate-lər: alacaq cəmi, borc cəmi, aylıq maaş cəmi
    const [debtAgg, creditAgg, payrollAgg] = await Promise.all([
      prisma.kontragentler.aggregate({
        where: { sahibkar_id: sahibkarId, aktiv: true, alacaq: { gt: 0 } },
        _sum: { alacaq: true },
      }),
      prisma.kontragentler.aggregate({
        where: { sahibkar_id: sahibkarId, aktiv: true, borc: { gt: 0 } },
        _sum: { borc: true },
      }),
      prisma.istifadeciler.aggregate({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        _sum: { aylik_maas: true },
      }),
    ]);

    const totalDebt = Number(debtAgg._sum.alacaq ?? 0);
    const totalCredit = Number(creditAgg._sum.borc ?? 0);
    const monthlyPayroll = Number(payrollAgg._sum.aylik_maas ?? 0);

    // 2. Haftəlik bucket-lərə paylan
    const weeks = Math.ceil(days / 7);
    const debtPerWeek = totalDebt > 0 ? totalDebt / weeks : 0;
    const creditPerWeek = totalCredit > 0 ? totalCredit / weeks : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets: ForecastBucket[] = [];

    for (let i = 0; i < weeks; i++) {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(startOfWeek.getDate() + i * 7);
      const bucketKey = startOfWeek.toISOString().slice(0, 10);

      // Aylıq maaş yalnız ayın 1-i ilə üst-üstə düşən həftədə tətbiq olunsun
      const monthStartInBucket = startOfWeek.getDate() <= 7;
      const recurringOut = monthStartInBucket ? monthlyPayroll : 0;

      const expectedIn = debtPerWeek;
      const supplierOut = creditPerWeek;
      buckets.push({
        bucket: bucketKey,
        expected_in: Math.round(expectedIn),
        recurring_out: Math.round(recurringOut),
        supplier_out: Math.round(supplierOut),
        net: Math.round(expectedIn - recurringOut - supplierOut),
      });
    }

    return buckets;
  });
}
