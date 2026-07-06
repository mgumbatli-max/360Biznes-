import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped, Prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export type FinanceKpis = {
  daxil_bu_ay: number;
  xaric_bu_ay: number;
  net_bu_ay: number;
  kassa_balans: number;
  alici_borcu: number; // receivables (musteri qisminden ala bilərik)
  techizatci_borcu: number; // payables (techizatci-ə borc)
};

/**
 * ⚠️ Köhnə kod-da raw SQL customer/supplier debt cəmində sahibkar_id filtri yox
 * idi — bütün tenant-ların datasını birləşdirirdi. İndi explicit ilə düzəldildi.
 */
async function fetchFinanceKpisRaw(sahibkarId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [salesAgg, expenseAgg, openKassa, customers, suppliers] = await Promise.all([
    prismaUnscoped.satis_sifarisleri.aggregate({
      where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, status: { not: "legv" }, qaralama: { not: true } },
      _sum: { odenilmis: true },
    }),
    prismaUnscoped.xercl_r.aggregate({
      // QA-orta: ləğv edilmiş xərc KPI-ya düşməsin
      where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, legv_de: null },
      _sum: { mebleg: true },
    }),
    prismaUnscoped.kassalar.aggregate({
      where: { sahibkar_id: sahibkarId, status: "acig" },
      _sum: { acilis_qaligi: true },
    }),
    prismaUnscoped.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(alacaq), 0)::float AS total
        FROM kontragentler
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND nov IN ('musteri', 'her_ikisi') AND alacaq > 0
    `,
    prismaUnscoped.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(borc), 0)::float AS total
        FROM kontragentler
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND nov IN ('techizatci', 'her_ikisi') AND borc > 0
    `,
  ]);

  return {
    daxil: Number(salesAgg._sum.odenilmis ?? 0),
    xaric: Number(expenseAgg._sum.mebleg ?? 0),
    kassa: Number(openKassa._sum.acilis_qaligi ?? 0),
    alici: Number(customers[0]?.total ?? 0),
    techizatci: Number(suppliers[0]?.total ?? 0),
  };
}

export async function getFinanceKpis(): Promise<FinanceKpis> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchFinanceKpisRaw(sahibkarId),
      ["finance-kpis", sahibkarId],
      { revalidate: 60, tags: [`maliyye:${sahibkarId}`] },
    );
    const raw = await cached();
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      daxil_bu_ay: raw.daxil * s,
      xaric_bu_ay: raw.xaric * s,
      net_bu_ay: (raw.daxil - raw.xaric) * s,
      kassa_balans: raw.kassa * s,
      alici_borcu: raw.alici * s,
      techizatci_borcu: raw.techizatci * s,
    };
  });
}

export type DashboardKpis = {
  bugun_gelir: number;
  bugun_xerc: number;
  bugun_net: number;
  ay_gelir: number;
  ay_xerc: number;
  ay_menfeet: number;
  ay_ebitda: number;
  debitor_cem: number;
  kreditor_cem: number;
  gozleyen_odenis: number;
  hesab_balans: number;
};

/**
 * ⚠️ Köhnə kod-da line 113-120 raw SQL `WHERE nov = ...` (sahibkar_id filtri yox)
 * — bütün tenant-ların borc/alacaq cəmini birləşdirirdi (multi-tenant leak).
 * İndi explicit sahibkar_id ilə düzəldildi.
 */
async function fetchMaliyyeDashboardKpisRaw(sahibkarId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    bugunSales,
    bugunExp,
    ayslaes,
    ayExp,
    customers,
    suppliers,
    openKassa,
    hesablar,
    gozleyenOp,
  ] = await Promise.all([
    prismaUnscoped.satis_sifarisleri.aggregate({
      where: { sahibkar_id: sahibkarId, tarix: { gte: todayStart }, status: { not: "legv" }, qaralama: { not: true } },
      _sum: { odenilmis: true },
    }),
    prismaUnscoped.xercl_r.aggregate({
      // QA-orta: ləğv edilmiş xərc KPI-ya düşməsin
      where: { sahibkar_id: sahibkarId, tarix: { gte: todayStart }, legv_de: null },
      _sum: { mebleg: true },
    }),
    prismaUnscoped.satis_sifarisleri.aggregate({
      where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, status: { not: "legv" }, qaralama: { not: true } },
      _sum: { odenilmis: true, umumi_mebleg: true },
    }),
    prismaUnscoped.xercl_r.aggregate({
      // QA-orta: ləğv edilmiş xərc KPI-ya düşməsin
      where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, legv_de: null },
      _sum: { mebleg: true },
    }),
    prismaUnscoped.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(alacaq), 0)::float AS total FROM kontragentler
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND nov IN ('musteri', 'her_ikisi') AND alacaq > 0
    `,
    prismaUnscoped.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(borc), 0)::float AS total FROM kontragentler
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND nov IN ('techizatci', 'her_ikisi') AND borc > 0
    `,
    prismaUnscoped.kassalar.aggregate({
      where: { sahibkar_id: sahibkarId, status: "acig" },
      _sum: { acilis_qaligi: true },
    }),
    prismaUnscoped.maliye_hesablari.aggregate({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      _sum: { qaliq: true },
    }),
    prismaUnscoped.finance_operations.count({
      where: { sahibkar_id: sahibkarId, status: "tesdiq_gozleyir" },
    }).catch(() => 0),
  ]);

  const ayGelir = Number(ayslaes._sum.odenilmis ?? 0);
  const ayXerc = Number(ayExp._sum.mebleg ?? 0);
  const ayMenfeet = ayGelir - ayXerc;

  return {
    bugun_gelir: Number(bugunSales._sum.odenilmis ?? 0),
    bugun_xerc: Number(bugunExp._sum.mebleg ?? 0),
    bugun_net: Number(bugunSales._sum.odenilmis ?? 0) - Number(bugunExp._sum.mebleg ?? 0),
    ay_gelir: ayGelir,
    ay_xerc: ayXerc,
    ay_menfeet: ayMenfeet,
    ay_ebitda: ayMenfeet,
    debitor_cem: Number(customers[0]?.total ?? 0),
    kreditor_cem: Number(suppliers[0]?.total ?? 0),
    gozleyen_odenis: Number(gozleyenOp ?? 0),
    hesab_balans: Number(openKassa._sum.acilis_qaligi ?? 0) + Number(hesablar._sum.qaliq ?? 0),
  };
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchMaliyyeDashboardKpisRaw(sahibkarId),
      ["maliyye-dashboard-kpis", sahibkarId],
      { revalidate: 60, tags: [`maliyye:${sahibkarId}`, `dashboard:${sahibkarId}`] },
    );
    const raw = await cached();
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return {
      bugun_gelir: raw.bugun_gelir * s,
      bugun_xerc: raw.bugun_xerc * s,
      bugun_net: raw.bugun_net * s,
      ay_gelir: raw.ay_gelir * s,
      ay_xerc: raw.ay_xerc * s,
      ay_menfeet: raw.ay_menfeet * s,
      ay_ebitda: raw.ay_ebitda * s,
      debitor_cem: raw.debitor_cem * s,
      kreditor_cem: raw.kreditor_cem * s,
      gozleyen_odenis: raw.gozleyen_odenis,
      hesab_balans: raw.hesab_balans * s,
    };
  });
}

export type DailyFlowRow = { gun: string; daxil: number; xaric: number };
export async function getDailyFlow(days = 30): Promise<DailyFlowRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.$queryRaw<DailyFlowRow[]>`
      WITH series AS (
        SELECT to_char(generate_series(
          CURRENT_DATE - (${days - 1}::int * INTERVAL '1 day'),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date, 'YYYY-MM-DD') AS gun
      )
      SELECT s.gun,
             COALESCE((SELECT SUM(odenilmis)::float FROM satis_sifarisleri ss
                        WHERE ss.sahibkar_id = ${sahibkarId}::uuid
                          AND to_char(ss.tarix, 'YYYY-MM-DD') = s.gun
                          AND ss.status != 'legv'
                          AND ss.qaralama IS NOT TRUE), 0) AS daxil,
             COALESCE((SELECT SUM(mebleg)::float FROM "xerclər" x
                        WHERE x.sahibkar_id = ${sahibkarId}::uuid
                          AND x.legv_de IS NULL -- QA-orta: ləğv edilmiş xərc trendə düşməsin
                          AND to_char(x.tarix, 'YYYY-MM-DD') = s.gun), 0) AS xaric
        FROM series s
       ORDER BY s.gun
    `;
  });
}

export type TopRow = { ad: string; mebleg: number };

export async function getTopExpenseCategories(limit = 5): Promise<TopRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.$queryRaw<TopRow[]>`
      SELECT COALESCE(xk.ad, 'Digər') AS ad,
             COALESCE(SUM(x.mebleg), 0)::float AS mebleg
        FROM "xerclər" x
   LEFT JOIN xerc_kateqoriyalari xk ON xk.id = x.kateqoriya_id
       WHERE x.sahibkar_id = ${sahibkarId}::uuid
         AND x.tarix >= date_trunc('month', CURRENT_DATE)
         AND x.legv_de IS NULL -- QA-orta: ləğv edilmiş xərc top-kateqoriyaya düşməsin
    GROUP BY xk.ad
    ORDER BY mebleg DESC
       LIMIT ${limit}
    `;
  });
}

export async function getTopDebtors(limit = 5): Promise<TopRow[]> {
  return withTenant(async () =>
    (await prisma.kontragentler.findMany({
      where: { aktiv: true, nov: { in: ["musteri", "her_ikisi"] }, alacaq: { gt: 0 } },
      orderBy: { alacaq: "desc" },
      take: limit,
      select: { ad: true, alacaq: true },
    })).map((r) => ({ ad: r.ad, mebleg: Number(r.alacaq ?? 0) }))
  );
}

export async function getQuickRefs() {
  return withTenant(async () => {
    const [hesablar, kontragentler, iscilier] = await Promise.all([
      prisma.maliye_hesablari.findMany({
        where: { aktiv: true },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true, valyuta: true, qaliq: true, nov: true },
      }).catch(() => [] as { id: string; ad: string; valyuta: string | null; qaliq: import("@prisma/client/runtime/library").Decimal | null; nov: string }[]),
      prisma.kontragentler.findMany({
        where: { aktiv: true },
        orderBy: { ad: "asc" },
        take: 500,
        select: { id: true, ad: true },
      }),
      prisma.istifadeciler.findMany({
        where: { aktiv: true },
        orderBy: { ad_soyad: "asc" },
        take: 300,
        select: { id: true, ad_soyad: true },
      }),
    ]);
    return {
      hesablar: hesablar.map((h) => ({
        id: h.id,
        ad: `${h.ad}${h.valyuta && h.valyuta !== "AZN" ? ` (${h.valyuta})` : ""}`,
        balans: Number(h.qaliq ?? 0),
        valyuta: h.valyuta ?? "AZN",
        nov: h.nov,
      })),
      kontragentler: kontragentler.map((k) => ({ id: k.id, ad: k.ad })),
      iscilier: iscilier.map((i) => ({ id: i.id, ad: i.ad_soyad })),
    };
  });
}

export async function getTopCreditors(limit = 5): Promise<TopRow[]> {
  return withTenant(async () =>
    (await prisma.kontragentler.findMany({
      where: { aktiv: true, nov: { in: ["techizatci", "her_ikisi"] }, borc: { gt: 0 } },
      orderBy: { borc: "desc" },
      take: limit,
      select: { ad: true, borc: true },
    })).map((r) => ({ ad: r.ad, mebleg: Math.abs(Number(r.borc ?? 0)) }))
  );
}

export type MonthlyFlow = { month: string; daxil: number; xaric: number };

export async function getMonthlyFlow(months = 6): Promise<MonthlyFlow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ month: string; daxil: number; xaric: number }[]>`
      WITH series AS (
        SELECT to_char(generate_series(
          date_trunc('month', CURRENT_DATE) - (${months - 1} * INTERVAL '1 month'),
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        ), 'YYYY-MM') AS month
      )
      SELECT s.month,
             COALESCE((SELECT SUM(odenilmis)::float FROM satis_sifarisleri ss
                        WHERE ss.sahibkar_id = ${sahibkarId}::uuid
                          AND to_char(ss.tarix, 'YYYY-MM') = s.month
                          AND ss.status != 'legv'
                          AND ss.qaralama IS NOT TRUE), 0) AS daxil,
             COALESCE((SELECT SUM(mebleg)::float FROM "xerclər" x
                        WHERE x.sahibkar_id = ${sahibkarId}::uuid
                          AND x.legv_de IS NULL -- QA-orta: ləğv edilmiş xərc trendə düşməsin
                          AND to_char(x.tarix, 'YYYY-MM') = s.month), 0) AS xaric
        FROM series s
       ORDER BY s.month
    `;
    return rows;
  });
}

export type ExpenseFilter = {
  search?: string;
  kateqoriya_id?: number[];
  from?: Date;
  to?: Date;
  /** Məbləğ aralığı (AZN-də deyil, orijinal məbləğ) */
  min?: number;
  max?: number;
  /** Ödəniş növü / hesab tipi: negd | kart | bank | kecirme */
  odenis_nov?: string[];
  /** "aktiv" (default) | "silinmis" | "hamisi" */
  silinmis?: "aktiv" | "silinmis" | "hamisi";
};

export type ExpenseRow = {
  id: string;
  tarix: Date;
  tesvir: string;
  mebleg: number;
  mebleg_azn: number;
  valyuta: string;
  mezenne: number;
  odenis_nov: string;
  qebz_nomresi: string | null;
  fayl_url: string | null;
  qeyd: string | null;
  kateqoriya_ad: string | null;
  kateqoriya_reng: string | null;
  kateqoriya_qrup: string | null;
  filial_ad: string | null;
  yaradan_ad: string | null;
  yaradildi: Date | null;
  yenilendi: Date | null;
  legv_de: Date | null;
  legv_sebeb: string | null;
};

export async function getExpenses(filter: ExpenseFilter, page = 1, pageSize = 50): Promise<{ items: ExpenseRow[]; total: number }> {
  return withTenant(async () => {
    const mode = filter.silinmis ?? "aktiv";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (mode === "aktiv") where.legv_de = null;
    else if (mode === "silinmis") where.legv_de = { not: null };
    // "hamisi" — heç bir filtr
    if (filter.kateqoriya_id?.length) where.kateqoriya_id = { in: filter.kateqoriya_id };
    if (filter.odenis_nov?.length) where.odenis_nov = { in: filter.odenis_nov };
    if (filter.from || filter.to) {
      where.tarix = {};
      if (filter.from) where.tarix.gte = filter.from;
      if (filter.to) where.tarix.lte = filter.to;
    }
    if (filter.min != null || filter.max != null) {
      where.mebleg = {};
      if (filter.min != null) where.mebleg.gte = filter.min;
      if (filter.max != null) where.mebleg.lte = filter.max;
    }
    if (filter.search) {
      where.tesvir = { contains: filter.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.xercl_r.findMany({
        where,
        orderBy: { tarix: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          xerc_kateqoriyalari: { select: { ad: true, reng: true, qrup: true } },
          filiallar: { select: { ad: true } },
          istifadeciler: { select: { ad_soyad: true } },
        },
      }),
      prisma.xercl_r.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        id: e.id,
        tarix: e.tarix,
        tesvir: e.tesvir,
        mebleg: Number(e.mebleg),
        mebleg_azn: Number(e.mebleg_azn ?? e.mebleg ?? 0),
        valyuta: e.valyuta ?? "AZN",
        mezenne: Number(e.mezenne ?? 1),
        odenis_nov: e.odenis_nov ?? "negd",
        qebz_nomresi: e.qebz_nomresi ?? null,
        fayl_url: e.fayl_url ?? null,
        qeyd: e.qeyd ?? null,
        kateqoriya_ad: e.xerc_kateqoriyalari?.ad ?? null,
        kateqoriya_reng: e.xerc_kateqoriyalari?.reng ?? null,
        kateqoriya_qrup: e.xerc_kateqoriyalari?.qrup ?? null,
        filial_ad: e.filiallar?.ad ?? null,
        yaradan_ad: e.istifadeciler?.ad_soyad ?? null,
        yaradildi: e.yaradildi ?? null,
        yenilendi: e.yenilendi ?? null,
        legv_de: e.legv_de ?? null,
        legv_sebeb: e.legv_sebeb ?? null,
      })),
      total,
    };
  });
}

export type PLReport = {
  donem: string;
  gelir: number;
  xerc_umumi: number;
  xerc_maas: number;
  xerc_vergi: number;
  xerc_diger: number;
  cemi_xerc: number;
  net_menfeet: number;
  marja: number;
  sahib_cixib: number;
};

export async function getPLReport(year: number, month: number): Promise<PLReport> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [sales, expByGroup, finOps] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: start, lt: end },
          status: { not: "legv" },
          qaralama: { not: true },
        },
        _sum: { odenilmis: true },
      }),
      prisma.$queryRaw<{ qrup: string | null; mebleg: number }[]>`
        SELECT COALESCE(xk.qrup, 'umumi') AS qrup, COALESCE(SUM(x.mebleg), 0)::float AS mebleg
          FROM "xerclər" x
          LEFT JOIN xerc_kateqoriyalari xk ON xk.id = x.kateqoriya_id
         WHERE x.sahibkar_id = ${sahibkarId}::uuid
           AND x.tarix >= ${start} AND x.tarix < ${end}
           AND x.legv_de IS NULL -- QA-orta: ləğv edilmiş xərc P&L-ə düşməsin
         GROUP BY xk.qrup
      `,
      prisma.$queryRaw<{ qrup: string | null; mebleg: number }[]>`
        SELECT COALESCE(ft.qrup, 'diger') AS qrup, COALESCE(SUM(fo.azn_meblegh), 0)::float AS mebleg
          FROM finance_operations fo
          LEFT JOIN finance_operation_types ft ON ft.id = fo.type_id
         WHERE fo.sahibkar_id = ${sahibkarId}::uuid
           AND fo.tarix >= ${start} AND fo.tarix < ${end}
           AND fo.status = 'aktiv'
           AND fo."yön" = 'xaric'
         GROUP BY ft.qrup
      `.catch(() => [] as { qrup: string | null; mebleg: number }[]),
    ]);

    const gelir = Number(sales._sum.odenilmis ?? 0);
    const groupMap = new Map<string, number>();
    for (const r of expByGroup) groupMap.set(r.qrup ?? "umumi", Number(r.mebleg ?? 0));
    for (const r of finOps) {
      const k = r.qrup ?? "diger";
      groupMap.set(k, (groupMap.get(k) ?? 0) + Number(r.mebleg ?? 0));
    }
    const xerc_maas = groupMap.get("maas") ?? 0;
    const xerc_vergi = (groupMap.get("vergi") ?? 0);
    const sahib_cixib = groupMap.get("sahibkar") ?? 0;
    let xerc_umumi = 0;
    let xerc_diger = 0;
    for (const [k, v] of groupMap.entries()) {
      if (k === "maas" || k === "vergi" || k === "sahibkar") continue;
      if (k === "umumi" || k === "" || k === null) xerc_umumi += v;
      else xerc_diger += v;
    }
    const cemi_xerc = xerc_umumi + xerc_maas + xerc_vergi + xerc_diger;
    const net_menfeet = gelir - cemi_xerc;
    const marja = gelir > 0 ? (net_menfeet / gelir) * 100 : 0;
    const aylar = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
    return {
      donem: `${aylar[month - 1]} ${year}`,
      gelir,
      xerc_umumi,
      xerc_maas,
      xerc_vergi,
      xerc_diger,
      cemi_xerc,
      net_menfeet,
      marja,
      sahib_cixib,
    };
  });
}

export type PaymentMethodRow = { nov: string; say: number; cemi: number };

export async function getPaymentMethodBreakdown(year: number, month: number): Promise<PaymentMethodRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return prisma.$queryRaw<PaymentMethodRow[]>`
      SELECT COALESCE(odenis_nov, 'negd') AS nov,
             COUNT(*)::int AS say,
             COALESCE(SUM(odenilmis), 0)::float AS cemi
        FROM satis_sifarisleri
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix >= ${start} AND tarix < ${end}
         AND status != 'legv'
         AND qaralama IS NOT TRUE
       GROUP BY odenis_nov
       ORDER BY cemi DESC
    `;
  });
}

export async function getExpenseCategories() {
  return withTenant(async () => {
    return prisma.xerc_kateqoriyalari.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
    });
  });
}

export type ExpenseCategoryUsage = {
  id: number;
  ad: string;
  reng: string | null;
  qrup: string | null;
  budce: number | null;
  istifade: number;
  faiz: number;
  asib: boolean;
};

/**
 * Per-category usage for the current month, with a soft "budget" computed as
 * the average monthly spend over the last 3 months (excluding current month).
 * If no historic data, budget is null and bar fills proportionally to top category.
 */
export async function getExpenseCategoryUsage(): Promise<ExpenseCategoryUsage[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ id: number; ad: string; reng: string | null; qrup: string | null; istifade: number; orta: number | null }[]>`
      SELECT xk.id,
             xk.ad,
             xk.reng,
             xk.qrup,
             COALESCE(cur.istifade, 0)::float AS istifade,
             prev.orta::float AS orta
        FROM xerc_kateqoriyalari xk
        LEFT JOIN (
          SELECT kateqoriya_id, SUM(mebleg_azn)::float AS istifade
            FROM "xerclər"
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND legv_de IS NULL -- QA-orta: ləğv edilmiş xərc istifadəyə düşməsin
             AND tarix >= date_trunc('month', CURRENT_DATE)
           GROUP BY kateqoriya_id
        ) cur ON cur.kateqoriya_id = xk.id
        LEFT JOIN (
          SELECT kateqoriya_id, AVG(mebleg_az_ay)::float AS orta FROM (
            SELECT kateqoriya_id,
                   date_trunc('month', tarix) AS ay,
                   SUM(mebleg_azn) AS mebleg_az_ay
              FROM "xerclər"
             WHERE sahibkar_id = ${sahibkarId}::uuid
               AND legv_de IS NULL -- QA-orta: ləğv edilmiş xərc orta büdcəyə düşməsin
               AND tarix >= date_trunc('month', CURRENT_DATE) - INTERVAL '3 months'
               AND tarix <  date_trunc('month', CURRENT_DATE)
             GROUP BY kateqoriya_id, date_trunc('month', tarix)
          ) m
          GROUP BY kateqoriya_id
        ) prev ON prev.kateqoriya_id = xk.id
       WHERE xk.sahibkar_id = ${sahibkarId}::uuid
         AND xk.aktiv = TRUE
       ORDER BY istifade DESC, xk.ad ASC
       LIMIT 12
    `.catch(() => [] as { id: number; ad: string; reng: string | null; qrup: string | null; istifade: number; orta: number | null }[]);
    return rows.map((r) => {
      const istifade = Number(r.istifade ?? 0);
      const budce = r.orta != null ? Number(r.orta) : null;
      const faiz = budce && budce > 0 ? (istifade / budce) * 100 : 0;
      return {
        id: Number(r.id),
        ad: r.ad,
        reng: r.reng,
        qrup: r.qrup,
        budce,
        istifade,
        faiz,
        asib: budce != null && budce > 0 && istifade > budce,
      };
    });
  });
}

export type DebtorRow = {
  id: string;
  ad: string;
  telefon: string | null;
  whatsapp: string | null;
  email: string | null;
  voen: string | null;
  borc: number;
  borc_limiti: number | null;
  limit_asib: boolean;
  son_alver: Date | null;
  gun_kecdi: number;
  menecer_ad: string | null;
  kateqoriya: string | null;
  yenilendi: Date | null;
  // Zəngin sətir məlumatı — UX1 (TX2)
  son_odenis_tarix: Date | null;
  son_odenis_mebleg: number | null;
  son_satis_nomre: string | null;
  son_satis_mebleg: number | null;
  acig_sened_say: number;
  avans: number;
};

export type DebtorFilter = {
  /** Kontragent axtarışı — ad / telefon / VÖEN / email */
  search?: string;
  /** Minimum borc (₼) */
  min?: number;
  /** Maksimum borc (₼) */
  max?: number;
  /** Son alver tarix aralığı — başlanğıc */
  from?: Date;
  /** Son alver tarix aralığı — son */
  to?: Date;
};

export async function getDebtors(filter: DebtorFilter = {}): Promise<DebtorRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    // ── Filtr fraqmentləri (param → where) ──────────────────────
    const search = filter.search?.trim();
    const searchSql = search
      ? Prisma.sql`AND (
          k.ad ILIKE ${"%" + search + "%"}
          OR k.telefon ILIKE ${"%" + search + "%"}
          OR k.voen ILIKE ${"%" + search + "%"}
          OR k.email ILIKE ${"%" + search + "%"}
        )`
      : Prisma.empty;
    const borcExpr = Prisma.sql`(COALESCE(os.open_total, 0) + COALESCE(sb.servis_total, 0))`;
    const minSql = filter.min != null ? Prisma.sql`AND ${borcExpr} >= ${filter.min}` : Prisma.empty;
    const maxSql = filter.max != null ? Prisma.sql`AND ${borcExpr} <= ${filter.max}` : Prisma.empty;
    const fromSql = filter.from ? Prisma.sql`AND os.son_satis >= ${filter.from}` : Prisma.empty;
    const toSql = filter.to ? Prisma.sql`AND os.son_satis <= ${filter.to}` : Prisma.empty;

    type Row = {
      id: string;
      ad: string;
      telefon: string | null;
      whatsapp: string | null;
      email: string | null;
      voen: string | null;
      borc: number;
      borc_limiti: number | null;
      son_alver: Date | null;
      gun_kecdi: number;
      menecer_ad: string | null;
      yenilendi: Date | null;
      son_odenis_tarix: Date | null;
      son_odenis_mebleg: number | null;
      son_satis_nomre: string | null;
      son_satis_mebleg: number | null;
      acig_sened_say: number;
      avans: number;
    };
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      WITH open_sales AS (
        SELECT s.musteri_id,
               SUM(s.son_mebleg - COALESCE(s.odenilmis, 0)) AS open_total,
               MAX(s.tarix) AS son_satis,
               MIN(s.tarix) FILTER (
                 WHERE s.son_mebleg - COALESCE(s.odenilmis, 0) > 0
               ) AS en_kohne_acig,
               COUNT(*) FILTER (
                 WHERE s.son_mebleg - COALESCE(s.odenilmis, 0) > 0
               ) AS acig_say
          FROM satis_sifarisleri s
         WHERE s.sahibkar_id = ${sahibkarId}::uuid
           AND COALESCE(s.status, '') NOT IN ('legv', 'qaytarilib')
           AND COALESCE(s.qaralama, false) = false
           AND s.odenis_nov IN ('nisye', 'borc')
         GROUP BY s.musteri_id
      ),
      -- QA-orta: servis borcu da debitora daxil (customer-balance.ts ilə eyni düstur)
      servis_borclar AS (
        SELECT sq.musteri_id,
               SUM(GREATEST(COALESCE(sq.temir_xerci, 0) - COALESCE(sq.musteriden_alinan, 0), 0)) AS servis_total
          FROM servis_qeydleri sq
         WHERE sq.sahibkar_id = ${sahibkarId}::uuid
           AND sq.deleted_at IS NULL
           AND sq.status NOT IN ('redd_edildi')
           AND sq.musteri_id IS NOT NULL
         GROUP BY sq.musteri_id
      ),
      son_satislar AS (
        SELECT DISTINCT ON (s.musteri_id)
               s.musteri_id, s.nomre, s.son_mebleg, s.tarix
          FROM satis_sifarisleri s
         WHERE s.sahibkar_id = ${sahibkarId}::uuid
           AND COALESCE(s.status, '') NOT IN ('legv', 'qaytarilib')
           AND COALESCE(s.qaralama, false) = false
         ORDER BY s.musteri_id, s.tarix DESC
      ),
      son_odenisler AS (
        SELECT DISTINCT ON (f.kontragent_id)
               f.kontragent_id, f.tarix, f.meblegh
          FROM finance_operations f
         WHERE f.sahibkar_id = ${sahibkarId}::uuid
           AND f.status = 'aktiv'
           AND f."yön" = 'daxil'
           AND f.type_kod IN ('qaime', 'borc_silinme')
           AND f.kontragent_id IS NOT NULL
         ORDER BY f.kontragent_id, f.tarix DESC
      )
      SELECT k.id::text AS id,
             k.ad,
             k.telefon,
             k.whatsapp,
             k.email,
             k.voen,
             (COALESCE(os.open_total, 0) + COALESCE(sb.servis_total, 0))::float AS borc, -- QA-orta: servis borcu daxil
             k.borc_limiti::float AS borc_limiti,
             os.son_satis AS son_alver,
             COALESCE((CURRENT_DATE - os.en_kohne_acig::date)::int, 0) AS gun_kecdi,
             u.ad_soyad AS menecer_ad,
             k.yenilendi,
             so.tarix AS son_odenis_tarix,
             so.meblegh::float AS son_odenis_mebleg,
             ss.nomre AS son_satis_nomre,
             ss.son_mebleg::float AS son_satis_mebleg,
             COALESCE(os.acig_say, 0)::int AS acig_sened_say,
             COALESCE(k.avans, 0)::float AS avans
        FROM kontragentler k
        LEFT JOIN open_sales os ON os.musteri_id = k.id
        LEFT JOIN servis_borclar sb ON sb.musteri_id = k.id
        LEFT JOIN son_satislar ss ON ss.musteri_id = k.id
        LEFT JOIN son_odenisler so ON so.kontragent_id = k.id
        LEFT JOIN istifadeciler u ON u.id = k.menecer_id
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
         AND k.aktiv = TRUE
         AND k.nov IN ('musteri', 'her_ikisi')
         AND (COALESCE(os.open_total, 0) + COALESCE(sb.servis_total, 0)) > 0 -- QA-orta: yalnız servis borclu müştəri də görünsün
         ${searchSql}
         ${minSql}
         ${maxSql}
         ${fromSql}
         ${toSql}
       ORDER BY borc DESC NULLS LAST
    `);
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      telefon: r.telefon,
      whatsapp: r.whatsapp,
      email: r.email,
      voen: r.voen,
      borc: Number(r.borc ?? 0),
      borc_limiti: r.borc_limiti != null ? Number(r.borc_limiti) : null,
      limit_asib: r.borc_limiti != null && Number(r.borc ?? 0) > Number(r.borc_limiti),
      son_alver: r.son_alver ?? null,
      gun_kecdi: Math.max(0, Number(r.gun_kecdi ?? 0)),
      menecer_ad: r.menecer_ad,
      kateqoriya: null,
      yenilendi: r.yenilendi ?? null,
      son_odenis_tarix: r.son_odenis_tarix ?? null,
      son_odenis_mebleg: r.son_odenis_mebleg != null ? Number(r.son_odenis_mebleg) : null,
      son_satis_nomre: r.son_satis_nomre,
      son_satis_mebleg: r.son_satis_mebleg != null ? Number(r.son_satis_mebleg) : null,
      acig_sened_say: Number(r.acig_sened_say ?? 0),
      avans: Number(r.avans ?? 0),
    }));
  });
}

export type CreditorRow = {
  id: string;
  ad: string;
  telefon: string | null;
  whatsapp: string | null;
  email: string | null;
  voen: string | null;
  borc: number;
  son_alver: Date | null;
  gun_kecdi: number;
  son_odenis_tarix: Date | null;
  son_odenis_mebleg: number | null;
  son_alis_nomre: string | null;
  son_alis_mebleg: number | null;
  acig_sened_say: number;
};

export type CreditorFilter = {
  /** Kontragent axtarışı — ad / telefon / VÖEN / email */
  search?: string;
  /** Minimum borc (₼) */
  min?: number;
  /** Maksimum borc (₼) */
  max?: number;
  /** Son alış tarix aralığı — başlanğıc */
  from?: Date;
  /** Son alış tarix aralığı — son */
  to?: Date;
};

export async function getCreditors(filter: CreditorFilter = {}): Promise<CreditorRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    // ── Filtr fraqmentləri (param → where) ──────────────────────
    const search = filter.search?.trim();
    const searchSql = search
      ? Prisma.sql`AND (
          k.ad ILIKE ${"%" + search + "%"}
          OR k.telefon ILIKE ${"%" + search + "%"}
          OR k.voen ILIKE ${"%" + search + "%"}
          OR k.email ILIKE ${"%" + search + "%"}
        )`
      : Prisma.empty;
    // Hesablanmış borc (kreditor sütunundakı ifadə ilə eyni)
    const borcExpr = Prisma.sql`GREATEST(
      COALESCE(k.borc, 0),
      ABS(LEAST(COALESCE(k.borc, 0), 0)),
      COALESCE(op.open_total, 0)
    )`;
    const minSql = filter.min != null ? Prisma.sql`AND ${borcExpr} >= ${filter.min}` : Prisma.empty;
    const maxSql = filter.max != null ? Prisma.sql`AND ${borcExpr} <= ${filter.max}` : Prisma.empty;
    const fromSql = filter.from ? Prisma.sql`AND op.son_alis >= ${filter.from}` : Prisma.empty;
    const toSql = filter.to ? Prisma.sql`AND op.son_alis <= ${filter.to}` : Prisma.empty;

    type Row = {
      id: string;
      ad: string;
      telefon: string | null;
      whatsapp: string | null;
      email: string | null;
      voen: string | null;
      borc: number;
      son_alver: Date | null;
      gun_kecdi: number;
      son_odenis_tarix: Date | null;
      son_odenis_mebleg: number | null;
      son_alis_nomre: string | null;
      son_alis_mebleg: number | null;
      acig_sened_say: number;
    };
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      WITH open_purch AS (
        SELECT a.techiazatci_id,
               SUM(a.umumi_mebleg - COALESCE(a.odenilmis, 0)) AS open_total,
               MAX(a.tarix) AS son_alis,
               MIN(a.tarix) FILTER (
                 WHERE a.umumi_mebleg - COALESCE(a.odenilmis, 0) > 0
               ) AS en_kohne_acig,
               COUNT(*) FILTER (
                 WHERE a.umumi_mebleg - COALESCE(a.odenilmis, 0) > 0
               ) AS acig_say
          FROM alis_sifarisleri a
         WHERE a.sahibkar_id = ${sahibkarId}::uuid
           AND COALESCE(a.status, '') <> 'legv'
         GROUP BY a.techiazatci_id
      ),
      son_alislar AS (
        SELECT DISTINCT ON (a.techiazatci_id)
               a.techiazatci_id, a.nomre, a.umumi_mebleg, a.tarix
          FROM alis_sifarisleri a
         WHERE a.sahibkar_id = ${sahibkarId}::uuid
           AND COALESCE(a.status, '') <> 'legv'
         ORDER BY a.techiazatci_id, a.tarix DESC
      ),
      son_odenisler AS (
        SELECT DISTINCT ON (f.kontragent_id)
               f.kontragent_id, f.tarix, f.meblegh
          FROM finance_operations f
         WHERE f.sahibkar_id = ${sahibkarId}::uuid
           AND f.status = 'aktiv'
           AND f."yön" = 'mexaric'
           AND f.type_kod = 'alis_odenis'
           AND f.kontragent_id IS NOT NULL
         ORDER BY f.kontragent_id, f.tarix DESC
      )
      SELECT k.id::text AS id,
             k.ad,
             k.telefon,
             k.whatsapp,
             k.email,
             k.voen,
             GREATEST(
               COALESCE(k.borc, 0),
               ABS(LEAST(COALESCE(k.borc, 0), 0)),
               COALESCE(op.open_total, 0)
             )::float AS borc,
             op.son_alis AS son_alver,
             COALESCE((CURRENT_DATE - op.en_kohne_acig::date)::int, 0) AS gun_kecdi,
             so.tarix AS son_odenis_tarix,
             so.meblegh::float AS son_odenis_mebleg,
             sa.nomre AS son_alis_nomre,
             sa.umumi_mebleg::float AS son_alis_mebleg,
             COALESCE(op.acig_say, 0)::int AS acig_sened_say
        FROM kontragentler k
        LEFT JOIN open_purch op ON op.techiazatci_id = k.id
        LEFT JOIN son_alislar sa ON sa.techiazatci_id = k.id
        LEFT JOIN son_odenisler so ON so.kontragent_id = k.id
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
         AND k.aktiv = TRUE
         AND k.nov IN ('techizatci', 'her_ikisi')
         AND (
           COALESCE(k.borc, 0) <> 0
           OR COALESCE(op.open_total, 0) > 0
         )
         ${searchSql}
         ${minSql}
         ${maxSql}
         ${fromSql}
         ${toSql}
       ORDER BY borc DESC NULLS LAST
    `);
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      telefon: r.telefon,
      whatsapp: r.whatsapp,
      email: r.email,
      voen: r.voen,
      borc: Number(r.borc ?? 0),
      son_alver: r.son_alver ?? null,
      gun_kecdi: Math.max(0, Number(r.gun_kecdi ?? 0)),
      son_odenis_tarix: r.son_odenis_tarix ?? null,
      son_odenis_mebleg: r.son_odenis_mebleg != null ? Number(r.son_odenis_mebleg) : null,
      son_alis_nomre: r.son_alis_nomre,
      son_alis_mebleg: r.son_alis_mebleg != null ? Number(r.son_alis_mebleg) : null,
      acig_sened_say: Number(r.acig_sened_say ?? 0),
    }));
  });
}

// ───────────────────────────────────────────────────────────
// NİSYƏ — Open sales for a customer (unpaid invoices)
// ───────────────────────────────────────────────────────────
export type OpenSaleOpt = {
  id: string;
  nomre: string;
  tarix: Date;
  qalig: number;
  son_mebleg: number;
  odenilmis: number;
  gun_kecdi: number;
  odenis_nov: string | null;
  satir_sayi: number;
  status: string | null;
};

export async function getOpenSalesForCustomer(musteri_id: string, limit = 50): Promise<OpenSaleOpt[]> {
  return withTenant(async () => {
    const rows = await prisma.satis_sifarisleri.findMany({
      where: {
        musteri_id,
        status: { notIn: ["legv", "qaytarilib"] },
        qaralama: { not: true },
        deleted_at: null,
        odenis_nov: { in: ["nisye", "borc"] },
      },
      orderBy: { tarix: "asc" },
      take: limit,
      select: {
        id: true,
        nomre: true,
        tarix: true,
        son_mebleg: true,
        odenilmis: true,
        odenis_nov: true,
        status: true,
        _count: { select: { satis_sifaris_satirlari: true } },
      },
    });
    const today = new Date();
    return rows
      .map((r) => {
        const son = Number(r.son_mebleg ?? 0);
        const od = Number(r.odenilmis ?? 0);
        const qalig = son - od;
        const days = Math.floor((today.getTime() - new Date(r.tarix).getTime()) / 86400000);
        return {
          id: r.id,
          nomre: r.nomre,
          tarix: r.tarix,
          qalig: Math.round(qalig * 100) / 100,
          son_mebleg: Math.round(son * 100) / 100,
          odenilmis: Math.round(od * 100) / 100,
          gun_kecdi: Math.max(0, days),
          odenis_nov: r.odenis_nov,
          status: r.status,
          satir_sayi: r._count?.satis_sifaris_satirlari ?? 0,
        };
      })
      .filter((r) => r.qalig > 0.001);
  });
}

/**
 * BATCH: bir neçə müştəri üçün açıq satışları TƏK sorğu ilə çək (N+1 önləmə — debitor səhifəsi əvvəl
 * top-25 müştəri üçün 25 ayrı sorğu atırdı). Nəticə: Map<musteri_id, OpenSaleOpt[]>. Məntiq
 * getOpenSalesForCustomer ilə eynidir.
 */
export async function getOpenSalesForCustomers(musteri_ids: string[], perCustomerLimit = 100): Promise<Map<string, OpenSaleOpt[]>> {
  return withTenant(async () => {
    const out = new Map<string, OpenSaleOpt[]>();
    if (!musteri_ids.length) return out;
    const rows = await prisma.satis_sifarisleri.findMany({
      where: {
        musteri_id: { in: musteri_ids },
        status: { notIn: ["legv", "qaytarilib"] },
        qaralama: { not: true },
        deleted_at: null,
        odenis_nov: { in: ["nisye", "borc"] },
      },
      orderBy: { tarix: "asc" },
      select: {
        id: true, nomre: true, tarix: true, son_mebleg: true, odenilmis: true,
        odenis_nov: true, status: true, musteri_id: true,
        _count: { select: { satis_sifaris_satirlari: true } },
      },
    });
    const today = new Date();
    for (const r of rows) {
      const son = Number(r.son_mebleg ?? 0);
      const od = Number(r.odenilmis ?? 0);
      const qalig = Math.round((son - od) * 100) / 100;
      if (qalig <= 0.001) continue;
      const key = r.musteri_id as string;
      if (!key) continue;
      const arr = out.get(key) ?? [];
      if (arr.length >= perCustomerLimit) continue;
      const days = Math.floor((today.getTime() - new Date(r.tarix).getTime()) / 86400000);
      arr.push({
        id: r.id, nomre: r.nomre, tarix: r.tarix, qalig,
        son_mebleg: Math.round(son * 100) / 100, odenilmis: Math.round(od * 100) / 100,
        gun_kecdi: Math.max(0, days), odenis_nov: r.odenis_nov, status: r.status,
        satir_sayi: r._count?.satis_sifaris_satirlari ?? 0,
      });
      out.set(key, arr);
    }
    return out;
  });
}

// ─── Təchizatçı açıq alışlar (kreditor üçün analoq) ─────────
export type OpenPurchaseOpt = {
  id: string;
  nomre: string;
  tarix: Date;
  qalig: number;
  umumi_mebleg: number;
  odenilmis: number;
  gun_kecdi: number;
  satir_sayi: number;
  status: string | null;
};

export async function getOpenPurchasesForSupplier(techizatci_id: string, limit = 50): Promise<OpenPurchaseOpt[]> {
  return withTenant(async () => {
    const rows = await prisma.alis_sifarisleri.findMany({
      where: {
        techiazatci_id: techizatci_id,
        status: { notIn: ["legv"] },
        deleted_at: null,
      },
      orderBy: { tarix: "asc" },
      take: limit,
      select: {
        id: true,
        nomre: true,
        tarix: true,
        umumi_mebleg: true,
        odenilmis: true,
        status: true,
        _count: { select: { alis_sifaris_satirlari: true } },
      },
    });
    const today = new Date();
    return rows
      .map((r) => {
        const umumi = Number(r.umumi_mebleg ?? 0);
        const od = Number(r.odenilmis ?? 0);
        const qalig = umumi - od;
        const days = Math.floor((today.getTime() - new Date(r.tarix).getTime()) / 86400000);
        return {
          id: r.id,
          nomre: r.nomre,
          tarix: r.tarix,
          qalig: Math.round(qalig * 100) / 100,
          umumi_mebleg: Math.round(umumi * 100) / 100,
          odenilmis: Math.round(od * 100) / 100,
          gun_kecdi: Math.max(0, days),
          status: r.status,
          satir_sayi: r._count?.alis_sifaris_satirlari ?? 0,
        };
      })
      .filter((r) => r.qalig > 0.001);
  });
}

// ───────────────────────────────────────────────────────────
// XƏRC → QAİMƏ — recent purchase invoices for combobox
// ───────────────────────────────────────────────────────────
export type RecentPurchaseOpt = {
  id: string;
  nomre: string;
  tarix: Date;
  techizatci_ad: string | null;
  umumi_mebleg: number;
};

export async function getRecentPurchases(days = 90, limit = 200): Promise<RecentPurchaseOpt[]> {
  return withTenant(async () => {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const rows = await prisma.alis_sifarisleri.findMany({
      where: { tarix: { gte: from } },
      orderBy: { tarix: "desc" },
      take: limit,
      select: {
        id: true,
        nomre: true,
        tarix: true,
        umumi_mebleg: true,
        kontragentler: { select: { ad: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      nomre: r.nomre,
      tarix: r.tarix,
      techizatci_ad: r.kontragentler?.ad ?? null,
      umumi_mebleg: Number(r.umumi_mebleg ?? 0),
    }));
  });
}

// ───────────────────────────────────────────────────────────
// XƏRC qaiməyə bağlı? — linked expenses for purchase detail
// ───────────────────────────────────────────────────────────
export type LinkedExpenseRow = {
  id: string;
  tarix: Date;
  mebleg: number;
  tesvir: string;
  kateqoriya_ad: string | null;
};

/** Debt aging buckets for receivables (customers who owe us) */
export async function getReceivableAging() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const orders = await prisma.satis_sifarisleri.findMany({
      where: {
        // customer-balance.ts SoT ilə eyni: yalnız nisyə/borc satışlar alacaqdır.
        // Əvvəl status whitelist + odenis_nov filtri olmadığı üçün nağd-amma-tam-
        // ödənilməmiş satışlar da "alacaq" kimi şişirdilirdi.
        sahibkar_id: sahibkarId,
        deleted_at: null,
        status: { notIn: ["legv", "qaytarilib"] },
        qaralama: { not: true },
        odenis_nov: { in: ["nisye", "borc"] },
      },
      select: { tarix: true, son_mebleg: true, odenilmis: true },
    });

    const buckets = [
      { label: "0-30 gün", min: 0, max: 30, amount: 0, count: 0 },
      { label: "31-60 gün", min: 31, max: 60, amount: 0, count: 0 },
      { label: "61-90 gün", min: 61, max: 90, amount: 0, count: 0 },
      { label: "91-180 gün", min: 91, max: 180, amount: 0, count: 0 },
      { label: "180+ gün", min: 181, max: 99999, amount: 0, count: 0 },
    ];

    let total = 0;
    for (const o of orders) {
      const debt = Number(o.son_mebleg ?? 0) - Number(o.odenilmis ?? 0);
      if (debt <= 0.01) continue;
      const days = Math.floor((now.getTime() - new Date(o.tarix).getTime()) / (24 * 3600 * 1000));
      const bucket = buckets.find((b) => days >= b.min && days <= b.max);
      if (bucket) {
        bucket.amount += debt;
        bucket.count += 1;
        total += debt;
      }
    }

    return { buckets, total };
  });
}

/** Top performing technicians for service module — based on completed orders, avg cycle time, revenue */
export async function getTechnicianLeaderboard(days = 30, limit = 10) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Aggregate per technician (servis_iscisi_id)
    const rows = await prisma.servis_qeydleri.groupBy({
      by: ["servis_iscisi_id"],
      where: {
        sahibkar_id: sahibkarId,
        yaradildi: { gte: cutoff },
        servis_iscisi_id: { not: null },
      },
      _count: { _all: true },
      _sum: { musteriden_alinan: true },
    });

    const technicianIds = rows.map((r) => r.servis_iscisi_id).filter((id): id is string => !!id);
    const users =
      technicianIds.length === 0
        ? []
        : await prisma.istifadeciler.findMany({
            where: { id: { in: technicianIds } },
            select: { id: true, ad_soyad: true, email: true },
          });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows
      .map((r) => {
        const user = r.servis_iscisi_id ? userMap.get(r.servis_iscisi_id) : null;
        const count = r._count._all;
        const revenue = Number(r._sum.musteriden_alinan ?? 0);
        return {
          texnik_id: r.servis_iscisi_id,
          ad_soyad: user?.ad_soyad ?? "—",
          email: user?.email ?? "",
          count,
          revenue,
          avg: count > 0 ? revenue / count : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  });
}

export async function getLinkedExpensesForPurchase(alis_id: string): Promise<LinkedExpenseRow[]> {
  return withTenant(async () => {
    const tag = `[INVOICE:${alis_id}]`;
    const rows = await prisma.xercl_r.findMany({
      where: { qeyd: { contains: tag }, legv_de: null },
      orderBy: { tarix: "desc" },
      take: 100,
      include: { xerc_kateqoriyalari: { select: { ad: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      tarix: r.tarix,
      mebleg: Number(r.mebleg),
      tesvir: r.tesvir,
      kateqoriya_ad: r.xerc_kateqoriyalari?.ad ?? null,
    }));
  });
}
