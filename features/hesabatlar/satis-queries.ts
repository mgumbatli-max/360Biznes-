import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";
import { silentFallback } from "@/lib/safe-query";
import type { DateRange } from "./shared";

export type SalesFilter = {
  range: DateRange;
  anbar_id?: number;
  satici_id?: string;
  odenis_nov?: string;
  kateqoriya_id?: number;
};

export type SalesKpi = {
  total_count: number;
  total_amount: number;
  total_discount: number;
  avg_sale: number;
  max_sale: number;
  new_customers: number;
  return_count: number;
  return_amount: number;
  return_rate: number;
};

export type SalesByDay = { date: string; amount: number; count: number };
export type SalesHeatCell = { dow: number; hour: number; say: number; meb: number };
export type PaymentSlice = { odenis_nov: string; count: number; amount: number };
export type AnbarSlice = { anbar_id: number | null; anbar_ad: string; count: number; amount: number };
export type UserSlice = { isci_id: string; ad: string; sifaris_say: number; cemi: number };
export type TopProduct = { mehsul_id: string; ad: string; kod: string | null; satilan_qty: number; cemi: number };
export type TopCustomer = { musteri_id: string; ad: string; sifaris_say: number; cemi: number };

function applyFilterClause(_f: SalesFilter): { extra: string } {
  // Currently filters are applied via Prisma.sql conditions in each query.
  return { extra: "" };
}

export async function getSalesKpi(f: SalesFilter): Promise<SalesKpi> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    void applyFilterClause(f);

    const where = {
      tarix: { gte: f.range.from, lte: f.range.to },
      status: { not: "legv" },
      qaralama: { not: true },
      ...(f.anbar_id ? { anbar_id: f.anbar_id } : {}),
      ...(f.satici_id ? { satis_meneceri_id: f.satici_id } : {}),
      ...(f.odenis_nov ? { odenis_nov: f.odenis_nov } : {}),
    };

    const [totalAgg, avgAgg, maxAgg, newCustRow, returnAgg] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where,
        _sum: { son_mebleg: true, endirim_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({ where, _avg: { son_mebleg: true } }),
      prisma.satis_sifarisleri.aggregate({ where, _max: { son_mebleg: true } }),
      prisma.$queryRaw<{ yeni: bigint }[]>`
        SELECT COUNT(*)::bigint AS yeni
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND yaradildi BETWEEN ${f.range.from} AND ${f.range.to}
           AND nov IN ('musteri','her_ikisi')
      `,
      prisma.$queryRaw<{ say: bigint; mebleg: number }[]>`
        SELECT COUNT(*)::bigint AS say,
               COALESCE(SUM(umumi_mebleg), 0)::float AS mebleg
          FROM qaytarma_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix BETWEEN ${f.range.from} AND ${f.range.to}
           -- QA-K30: təsdiqlənməmiş/ləğv edilmiş qaytarmalar KPI-yə düşməsin
           AND status NOT IN ('legv','tesdiqlenmemis')
      `.catch(silentFallback("getSatisKpi.qaytarma", [{ say: 0n, mebleg: 0 }])),
    ]);

    const total_count = totalAgg._count._all;
    const total_amount = Number(totalAgg._sum.son_mebleg ?? 0);
    const return_count = Number(returnAgg[0]?.say ?? 0);

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      total_count,
      total_amount: total_amount * s,
      total_discount: Number(totalAgg._sum.endirim_mebleg ?? 0) * s,
      avg_sale: Number(avgAgg._avg.son_mebleg ?? 0) * s,
      max_sale: Number(maxAgg._max.son_mebleg ?? 0) * s,
      new_customers: Number(newCustRow[0]?.yeni ?? 0),
      return_count,
      return_amount: Number(returnAgg[0]?.mebleg ?? 0) * s,
      return_rate: total_count > 0 ? (return_count / total_count) * 100 : 0,
    };
  });
}

export async function getDailySales(f: SalesFilter): Promise<SalesByDay[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ d: Date; amount: number; count: number }[]>`
      SELECT date_trunc('day', tarix)::date AS d,
             COALESCE(SUM(son_mebleg), 0)::float AS amount,
             COUNT(*)::int AS count
        FROM satis_sifarisleri
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix BETWEEN ${f.range.from} AND ${f.range.to}
         AND status != 'legv'
         AND qaralama IS NOT TRUE
       GROUP BY 1
       ORDER BY 1 ASC
    `;
    return rows.map((r) => ({
      date: r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d),
      amount: Number(r.amount),
      count: Number(r.count),
    }));
  });
}

export async function getSalesHeatmap(f: SalesFilter): Promise<SalesHeatCell[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ dow: number; hour: number; say: number; meb: number }[]>`
      SELECT EXTRACT(DOW  FROM COALESCE(yaradildi, tarix))::int AS dow,
             EXTRACT(HOUR FROM COALESCE(yaradildi, tarix))::int AS hour,
             COUNT(*)::int AS say,
             COALESCE(SUM(son_mebleg), 0)::float AS meb
        FROM satis_sifarisleri
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix BETWEEN ${f.range.from} AND ${f.range.to}
         AND COALESCE(status, '') <> 'legv'
         AND COALESCE(qaralama, false) = false
       GROUP BY 1, 2
       ORDER BY 1, 2
    `;
    return rows.map((r) => ({
      dow: Number(r.dow),
      hour: Number(r.hour),
      say: Number(r.say),
      meb: Number(r.meb),
    }));
  });
}

export async function getPaymentMethodSlices(f: SalesFilter): Promise<PaymentSlice[]> {
  return withTenant(async () => {
    const rows = await prisma.satis_sifarisleri.groupBy({
      by: ["odenis_nov"],
      where: {
        tarix: { gte: f.range.from, lte: f.range.to },
        status: { not: "legv" },
        qaralama: { not: true },
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

export async function getSalesByWarehouse(f: SalesFilter): Promise<AnbarSlice[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      { anbar_id: number | null; anbar_ad: string | null; count: number; amount: number }[]
    >`
      SELECT a.id AS anbar_id, a.ad AS anbar_ad,
             COUNT(ss.id)::int AS count,
             COALESCE(SUM(ss.son_mebleg), 0)::float AS amount
        FROM satis_sifarisleri ss
        LEFT JOIN anbarlar a ON a.id = ss.anbar_id
       WHERE ss.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${f.range.from} AND ${f.range.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY a.id, a.ad
       ORDER BY amount DESC
    `;
    return rows.map((r) => ({
      anbar_id: r.anbar_id,
      anbar_ad: r.anbar_ad ?? "—",
      count: Number(r.count),
      amount: Number(r.amount),
    }));
  });
}

export async function getSalesByUser(f: SalesFilter, limit = 10): Promise<UserSlice[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ isci_id: string; ad: string; sifaris_say: number; cemi: number }[]>`
      SELECT u.id::text AS isci_id, u.ad_soyad AS ad,
             COUNT(ss.id)::int AS sifaris_say,
             COALESCE(SUM(ss.son_mebleg), 0)::float AS cemi
        FROM satis_sifarisleri ss
        JOIN istifadeciler u ON u.id = ss.satis_meneceri_id
       WHERE ss.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${f.range.from} AND ${f.range.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY u.id, u.ad_soyad
       ORDER BY cemi DESC
       LIMIT ${limit}
    `;
    return rows;
  });
}

export async function getTopProductsExt(f: SalesFilter, limit = 20): Promise<TopProduct[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<TopProduct[]>`
      SELECT m.id::text AS mehsul_id, m.ad, m.kod,
             SUM(sls.miqdar)::float AS satilan_qty,
             SUM(sls.cemi)::float AS cemi
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${f.range.from} AND ${f.range.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY m.id, m.ad, m.kod
       ORDER BY cemi DESC
       LIMIT ${limit}
    `;
    return rows.map((r) => ({
      ...r,
      satilan_qty: Number(r.satilan_qty),
      cemi: Number(r.cemi),
    }));
  });
}

export async function getTopCustomersExt(f: SalesFilter, limit = 20): Promise<TopCustomer[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<TopCustomer[]>`
      SELECT k.id::text AS musteri_id, k.ad,
             COUNT(ss.id)::int AS sifaris_say,
             COALESCE(SUM(ss.son_mebleg), 0)::float AS cemi
        FROM satis_sifarisleri ss
        JOIN kontragentler k ON k.id = ss.musteri_id
       WHERE ss.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${f.range.from} AND ${f.range.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY k.id, k.ad
       ORDER BY cemi DESC
       LIMIT ${limit}
    `;
    return rows.map((r) => ({
      ...r,
      sifaris_say: Number(r.sifaris_say),
      cemi: Number(r.cemi),
    }));
  });
}

export async function getMonthlyComparison(range: DateRange) {
  return withTenant(async () => {
    const prevFrom = new Date(range.from);
    prevFrom.setMonth(prevFrom.getMonth() - 1);
    const prevTo = new Date(range.to);
    prevTo.setMonth(prevTo.getMonth() - 1);

    const [thisAgg, prevAgg] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: range.from, lte: range.to }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: prevFrom, lte: prevTo }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
    ]);

    const cur = Number(thisAgg._sum.son_mebleg ?? 0);
    const prev = Number(prevAgg._sum.son_mebleg ?? 0);
    const change_pct = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
    return {
      cur_amount: cur,
      prev_amount: prev,
      cur_count: thisAgg._count._all,
      prev_count: prevAgg._count._all,
      change_pct,
    };
  });
}

export type GroupKey = "gun" | "hefte" | "ay" | "menecer" | "musteri" | "anbar" | "odenis";
export type PivotRow = { label: string; sub?: string | null; cemi: number; sifaris_say: number; orta_chek: number };

/**
 * Generic pivot grouping for the sales report — used by the "Qruplaşdır" dropdown.
 */
export async function getSalesPivot(f: SalesFilter, group: GroupKey): Promise<PivotRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    let rows: { label: string; sub: string | null; cemi: number; sifaris_say: number }[] = [];
    try {
      if (group === "gun" || group === "hefte" || group === "ay") {
        const fmt = group === "gun" ? "YYYY-MM-DD" : group === "hefte" ? "IYYY-IW" : "YYYY-MM";
        rows = await prisma.$queryRaw<{ label: string; sub: string | null; cemi: number; sifaris_say: number }[]>`
          SELECT to_char(tarix, ${fmt}) AS label,
                 NULL AS sub,
                 COALESCE(SUM(son_mebleg), 0)::float AS cemi,
                 COUNT(*)::int AS sifaris_say
            FROM satis_sifarisleri
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND tarix BETWEEN ${f.range.from} AND ${f.range.to}
             AND status != 'legv'
             AND qaralama IS NOT TRUE
           GROUP BY label
           ORDER BY label ASC
        `;
      } else if (group === "menecer") {
        rows = await prisma.$queryRaw`
          SELECT COALESCE(u.ad_soyad, '—') AS label,
                 NULL AS sub,
                 COALESCE(SUM(ss.son_mebleg), 0)::float AS cemi,
                 COUNT(*)::int AS sifaris_say
            FROM satis_sifarisleri ss
            LEFT JOIN istifadeciler u ON u.id = ss.satis_meneceri_id
           WHERE ss.sahibkar_id = ${sahibkarId}::uuid
             AND ss.tarix BETWEEN ${f.range.from} AND ${f.range.to}
             AND ss.status != 'legv'
             AND ss.qaralama IS NOT TRUE
           GROUP BY u.ad_soyad
           ORDER BY cemi DESC
        `;
      } else if (group === "musteri") {
        rows = await prisma.$queryRaw`
          SELECT COALESCE(k.ad, '—') AS label,
                 k.telefon AS sub,
                 COALESCE(SUM(ss.son_mebleg), 0)::float AS cemi,
                 COUNT(*)::int AS sifaris_say
            FROM satis_sifarisleri ss
            LEFT JOIN kontragentler k ON k.id = ss.musteri_id
           WHERE ss.sahibkar_id = ${sahibkarId}::uuid
             AND ss.tarix BETWEEN ${f.range.from} AND ${f.range.to}
             AND ss.status != 'legv'
             AND ss.qaralama IS NOT TRUE
           GROUP BY k.ad, k.telefon
           ORDER BY cemi DESC
           LIMIT 200
        `;
      } else if (group === "anbar") {
        rows = await prisma.$queryRaw`
          SELECT COALESCE(a.ad, '—') AS label,
                 NULL AS sub,
                 COALESCE(SUM(ss.son_mebleg), 0)::float AS cemi,
                 COUNT(*)::int AS sifaris_say
            FROM satis_sifarisleri ss
            LEFT JOIN anbarlar a ON a.id = ss.anbar_id
           WHERE ss.sahibkar_id = ${sahibkarId}::uuid
             AND ss.tarix BETWEEN ${f.range.from} AND ${f.range.to}
             AND ss.status != 'legv'
             AND ss.qaralama IS NOT TRUE
           GROUP BY a.ad
           ORDER BY cemi DESC
        `;
      } else {
        // odenis
        rows = await prisma.$queryRaw`
          SELECT COALESCE(odenis_nov, 'negd') AS label,
                 NULL AS sub,
                 COALESCE(SUM(son_mebleg), 0)::float AS cemi,
                 COUNT(*)::int AS sifaris_say
            FROM satis_sifarisleri
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND tarix BETWEEN ${f.range.from} AND ${f.range.to}
             AND status != 'legv'
             AND qaralama IS NOT TRUE
           GROUP BY odenis_nov
           ORDER BY cemi DESC
        `;
      }
    } catch (e) {
      console.error("[getSalesPivot]", e);
      rows = [];
    }
    return rows.map((r) => {
      const cemi = Number(r.cemi);
      const sayi = Number(r.sifaris_say);
      return {
        label: r.label,
        sub: r.sub ?? null,
        cemi,
        sifaris_say: sayi,
        orta_chek: sayi > 0 ? cemi / sayi : 0,
      };
    });
  });
}

/** Year-over-year comparison: this range vs same range 1 year ago. */
export async function getYoyComparison(range: DateRange) {
  return withTenant(async () => {
    const yoyFrom = new Date(range.from);
    yoyFrom.setFullYear(yoyFrom.getFullYear() - 1);
    const yoyTo = new Date(range.to);
    yoyTo.setFullYear(yoyTo.getFullYear() - 1);

    const [curAgg, yoyAgg] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: range.from, lte: range.to }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: yoyFrom, lte: yoyTo }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
    ]);
    const cur = Number(curAgg._sum.son_mebleg ?? 0);
    const prev = Number(yoyAgg._sum.son_mebleg ?? 0);
    const change_pct = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
    return {
      cur_amount: cur,
      yoy_amount: prev,
      cur_count: curAgg._count._all,
      yoy_count: yoyAgg._count._all,
      change_pct,
    };
  });
}

export type MarginRow = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  qty: number;
  revenue: number;
  cogs: number;
  margin: number;
  margin_pct: number;
};

/** Per-product gross margin in the selected range. Sorted by margin_pct desc by default. */
export async function getMarginByProduct(f: SalesFilter, limit = 20, order: "best" | "worst" = "best"): Promise<MarginRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const sortDir = order === "best" ? "DESC" : "ASC";
    const rows = await prisma.$queryRawUnsafe<MarginRow[]>(
      `
      SELECT m.id::text AS mehsul_id, m.ad, m.kod,
             SUM(sls.miqdar)::float AS qty,
             SUM(sls.cemi)::float AS revenue,
             SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0))::float AS cogs,
             (SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0)))::float AS margin,
             CASE WHEN SUM(sls.cemi) > 0
                  THEN ((SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0))) / SUM(sls.cemi) * 100)::float
                  ELSE 0 END AS margin_pct
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
       WHERE sls.sahibkar_id = $1::uuid
         AND ss.tarix BETWEEN $2 AND $3
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY m.id, m.ad, m.kod
       HAVING SUM(sls.miqdar) > 0
       ORDER BY margin_pct ${sortDir}
       LIMIT $4
    `,
      sahibkarId,
      f.range.from,
      f.range.to,
      limit
    );
    return rows.map((r) => ({
      ...r,
      qty: Number(r.qty),
      revenue: Number(r.revenue),
      cogs: Number(r.cogs),
      margin: Number(r.margin),
      margin_pct: Number(r.margin_pct),
    }));
  });
}

export type HourlyPerf = { saat: number; sayi: number; mebleg: number };

/** Best/worst hour analysis across the period. */
export async function getHourlyPerf(f: SalesFilter): Promise<HourlyPerf[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<HourlyPerf[]>`
      SELECT EXTRACT(HOUR FROM COALESCE(yaradildi, tarix))::int AS saat,
             COUNT(*)::int AS sayi,
             COALESCE(SUM(son_mebleg), 0)::float AS mebleg
        FROM satis_sifarisleri
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix BETWEEN ${f.range.from} AND ${f.range.to}
         AND status != 'legv'
         AND qaralama IS NOT TRUE
       GROUP BY 1
       ORDER BY 1
    `;
    return rows.map((r) => ({ saat: Number(r.saat), sayi: Number(r.sayi), mebleg: Number(r.mebleg) }));
  });
}

export async function getAnbarlar(): Promise<{ id: number; ad: string }[]> {
  return withTenant(async () => {
    const rows = await prisma.anbarlar.findMany({
      where: { aktiv: true },
      select: { id: true, ad: true },
      orderBy: { ad: "asc" },
    });
    return rows;
  });
}
