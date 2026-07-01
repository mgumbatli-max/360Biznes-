import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { canSeeContactPII, maskContactPII } from "@/features/elaqe/mask-pii";
import type { DateRange } from "./shared";

export type CustomerLtvRow = {
  id: string;
  ad: string;
  telefon: string | null;
  sheher: string | null;
  orders: number;
  revenue_period: number;
  ltv: number;
  last_order: Date | null;
};

export type CustomerSegment = "all" | "vip" | "aktiv" | "yatmis" | "borclu";

export async function getTopCustomersLtv(range: DateRange, limit = 50, segment: CustomerSegment = "all"): Promise<CustomerLtvRow[]> {
  return withTenant(async () => {
    const { sahibkarId, rolAd, icazeler } = requireTenant();
    // 🔒 (audit #5) telefon yalnız musteri.gizli olana açıq — əks halda maskalanır.
    const canSeePII = canSeeContactPII(rolAd, icazeler);
    const rows = await prisma.$queryRaw<(CustomerLtvRow & { email: string | null; borc: number })[]>`
      SELECT k.id::text, k.ad, k.telefon, k.sheher, k.email,
             COALESCE(k.borc, 0)::float AS borc,
             COUNT(ss.id)::int AS orders,
             COALESCE(SUM(CASE WHEN ss.tarix BETWEEN ${range.from} AND ${range.to} THEN ss.son_mebleg ELSE 0 END), 0)::float AS revenue_period,
             COALESCE(SUM(ss.son_mebleg), 0)::float AS ltv,
             MAX(ss.tarix) AS last_order
        FROM kontragentler k
        LEFT JOIN satis_sifarisleri ss ON ss.musteri_id = k.id AND ss.status != 'legv'
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
         AND k.aktiv = TRUE
         AND k.nov IN ('musteri','her_ikisi')
       GROUP BY k.id, k.ad, k.telefon, k.sheher, k.email, k.borc
       ORDER BY ltv DESC
       LIMIT ${limit * 4}
    `;
    const enriched = rows.map((r) => ({
      ...r,
      orders: Number(r.orders),
      revenue_period: Number(r.revenue_period),
      ltv: Number(r.ltv),
      borc: Number(r.borc ?? 0),
    }));
    // Segment filtering
    const now = new Date();
    const cutoffYatmis = new Date(now.getTime() - 90 * 86400000);
    const ltvSorted = [...enriched].sort((a, b) => b.ltv - a.ltv);
    const vipCutoff = ltvSorted[Math.floor(ltvSorted.length * 0.1)]?.ltv ?? Infinity; // top 10% LTV
    const filtered = enriched.filter((r) => {
      if (segment === "vip") return r.ltv >= vipCutoff && r.ltv > 0;
      if (segment === "aktiv") return r.orders > 0 && r.last_order && new Date(r.last_order) >= cutoffYatmis;
      if (segment === "yatmis") return !r.last_order || new Date(r.last_order) < cutoffYatmis;
      if (segment === "borclu") return r.borc > 0;
      return true;
    });
    return filtered.slice(0, limit).map((r) => maskContactPII({
      id: r.id,
      ad: r.ad,
      telefon: r.telefon,
      sheher: r.sheher,
      orders: r.orders,
      revenue_period: r.revenue_period,
      ltv: r.ltv,
      last_order: r.last_order,
    }, canSeePII) as CustomerLtvRow);
  });
}

export type CustomerExportRow = {
  ad: string;
  telefon: string | null;
  email: string | null;
  sheher: string | null;
  ltv: number;
  borc: number;
};

export async function getCustomersForExport(segment: CustomerSegment = "all", limit = 5000): Promise<CustomerExportRow[]> {
  return withTenant(async () => {
    const { sahibkarId, rolAd, icazeler } = requireTenant();
    // 🔒 (audit #7) export-da telefon/email yalnız musteri.gizli olana açıq.
    const canSeePII = canSeeContactPII(rolAd, icazeler);
    const rows = await prisma.$queryRaw<{ ad: string; telefon: string | null; email: string | null; sheher: string | null; ltv: number; borc: number; last_order: Date | null; orders: number }[]>`
      SELECT k.ad, k.telefon, k.email, k.sheher,
             COALESCE(SUM(ss.son_mebleg), 0)::float AS ltv,
             COALESCE(k.borc, 0)::float AS borc,
             MAX(ss.tarix) AS last_order,
             COUNT(ss.id)::int AS orders
        FROM kontragentler k
        LEFT JOIN satis_sifarisleri ss ON ss.musteri_id = k.id AND ss.status != 'legv'
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
         AND k.aktiv = TRUE
         AND k.nov IN ('musteri','her_ikisi')
       GROUP BY k.id, k.ad, k.telefon, k.email, k.sheher, k.borc
       ORDER BY ltv DESC
       LIMIT ${limit}
    `;
    const cutoffYatmis = new Date(Date.now() - 90 * 86400000);
    const ltvSorted = [...rows].sort((a, b) => Number(b.ltv) - Number(a.ltv));
    const vipCutoff = ltvSorted[Math.floor(ltvSorted.length * 0.1)]?.ltv ?? Infinity;
    return rows
      .filter((r) => {
        if (segment === "vip") return Number(r.ltv) >= Number(vipCutoff) && Number(r.ltv) > 0;
        if (segment === "aktiv") return Number(r.orders) > 0 && r.last_order && new Date(r.last_order) >= cutoffYatmis;
        if (segment === "yatmis") return !r.last_order || new Date(r.last_order) < cutoffYatmis;
        if (segment === "borclu") return Number(r.borc) > 0;
        return true;
      })
      .map((r) => maskContactPII({
        ad: r.ad,
        telefon: r.telefon,
        email: r.email,
        sheher: r.sheher,
        ltv: Number(r.ltv),
        borc: Number(r.borc),
      }, canSeePII) as CustomerExportRow);
  });
}

export type NewReturningStats = {
  total: number;
  new_count: number;
  returning_count: number;
  active_in_period: number;
};

export async function getNewReturning(range: DateRange): Promise<NewReturningStats> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [active, newOnes, returning, total] = await Promise.all([
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(DISTINCT musteri_id)::bigint AS c
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix BETWEEN ${range.from} AND ${range.to}
           AND musteri_id IS NOT NULL
           AND status != 'legv'
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND yaradildi BETWEEN ${range.from} AND ${range.to}
           AND nov IN ('musteri','her_ikisi')
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c FROM (
          SELECT musteri_id FROM satis_sifarisleri
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND tarix BETWEEN ${range.from} AND ${range.to}
             AND musteri_id IS NOT NULL
             AND status != 'legv'
           GROUP BY musteri_id
          HAVING COUNT(*) >= 2
        ) sub
      `,
      prisma.kontragentler.count({ where: { aktiv: true, nov: { in: ["musteri", "her_ikisi"] } } }),
    ]);
    return {
      total,
      new_count: Number(newOnes[0]?.c ?? 0),
      returning_count: Number(returning[0]?.c ?? 0),
      active_in_period: Number(active[0]?.c ?? 0),
    };
  });
}

export type CityRow = { sheher: string; sayi: number; ltv: number };

export async function getGeoDistribution(limit = 20): Promise<CityRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<CityRow[]>`
      SELECT COALESCE(NULLIF(TRIM(k.sheher), ''), 'Naməlum') AS sheher,
             COUNT(DISTINCT k.id)::int AS sayi,
             COALESCE(SUM(ss.son_mebleg), 0)::float AS ltv
        FROM kontragentler k
        LEFT JOIN satis_sifarisleri ss ON ss.musteri_id = k.id AND ss.status != 'legv'
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
         AND k.aktiv = TRUE
         AND k.nov IN ('musteri','her_ikisi')
       GROUP BY 1
       ORDER BY sayi DESC
       LIMIT ${limit}
    `;
    return rows.map((r) => ({ ...r, sayi: Number(r.sayi), ltv: Number(r.ltv) }));
  });
}

export type PaymentPref = { odenis_nov: string; count: number; amount: number };

export async function getCustomerPaymentPref(range: DateRange): Promise<PaymentPref[]> {
  return withTenant(async () => {
    const rows = await prisma.satis_sifarisleri.groupBy({
      by: ["odenis_nov"],
      where: {
        tarix: { gte: range.from, lte: range.to },
        status: { not: "legv" },
        musteri_id: { not: null },
      },
      _sum: { son_mebleg: true },
      _count: { _all: true },
    });
    return rows.map((r) => ({
      odenis_nov: r.odenis_nov ?? "negd",
      count: r._count._all,
      amount: Number(r._sum.son_mebleg ?? 0),
    }));
  });
}

export type DebtBucket = { bucket: string; count: number; amount: number };

export async function getDebtBuckets(): Promise<DebtBucket[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ bucket: string; count: number; amount: number }[]>`
      WITH d AS (
        -- QA-K31: vahid effective-debt düsturu (alacaq SoT + legacy fallback);
        -- əvvəl borc oxunur, aktiv/nov filtri yox idi (təchizatçılar da düşürdü)
        SELECT k.id,
               (CURRENT_DATE - GREATEST(k.son_temas::date, k.yenilendi::date, k.yaradildi::date))::int AS gun,
               (CASE WHEN COALESCE(k.alacaq,0) > 0 THEN k.alacaq
                     WHEN k.nov = 'musteri' THEN k.borc ELSE 0 END)::float AS borc
          FROM kontragentler k
         WHERE k.sahibkar_id = ${sahibkarId}::uuid
           AND COALESCE(k.aktiv, TRUE) = TRUE
           AND k.nov IN ('musteri','her_ikisi')
           AND (COALESCE(k.alacaq,0) > 0 OR (k.nov = 'musteri' AND COALESCE(k.borc,0) > 0))
      ),
      b AS (
        SELECT CASE
                 WHEN gun IS NULL OR gun <= 30 THEN '0-30'
                 WHEN gun <= 60 THEN '31-60'
                 WHEN gun <= 90 THEN '61-90'
                 ELSE '90+'
               END AS bucket,
               borc
          FROM d
      )
      SELECT bucket, COUNT(*)::int AS count, COALESCE(SUM(borc), 0)::float AS amount
        FROM b
       GROUP BY bucket
       ORDER BY CASE WHEN bucket = '0-30' THEN 1 WHEN bucket = '31-60' THEN 2 WHEN bucket = '61-90' THEN 3 ELSE 4 END
    `;
    return rows.map((r) => ({ ...r, count: Number(r.count), amount: Number(r.amount) }));
  });
}

export type CohortCell = {
  cohort: string;
  cohort_size: number;
  returned_pct: number;
};

/** Simple cohort: how many customers from each "first-purchase month" are still buying in current month. */
export async function getSimpleCohort(monthsBack = 6): Promise<CohortCell[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const rows = await prisma.$queryRaw<{ cohort: string; cohort_size: number; returned: number }[]>`
      WITH first_buy AS (
        SELECT musteri_id, MIN(tarix) AS ilk
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND musteri_id IS NOT NULL
           AND status != 'legv'
         GROUP BY musteri_id
      ),
      cohorts AS (
        SELECT to_char(ilk, 'YYYY-MM') AS cohort, musteri_id
          FROM first_buy
         WHERE ilk >= (date_trunc('month', CURRENT_DATE) - (${monthsBack} || ' months')::interval)
      )
      SELECT c.cohort,
             COUNT(DISTINCT c.musteri_id)::int AS cohort_size,
             COUNT(DISTINCT CASE WHEN ss2.tarix >= ${monthStart} THEN c.musteri_id END)::int AS returned
        FROM cohorts c
        LEFT JOIN satis_sifarisleri ss2
               ON ss2.musteri_id = c.musteri_id
              AND ss2.sahibkar_id = ${sahibkarId}::uuid
              AND ss2.status != 'legv'
       GROUP BY c.cohort
       ORDER BY c.cohort DESC
    `;
    return rows.map((r) => ({
      cohort: r.cohort,
      cohort_size: Number(r.cohort_size),
      returned_pct: Number(r.cohort_size) > 0 ? (Number(r.returned) / Number(r.cohort_size)) * 100 : 0,
    }));
  });
}
