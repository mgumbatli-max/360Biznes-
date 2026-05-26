import "server-only";
import { prisma } from "@/lib/db/prisma";
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

export async function getFinanceKpis(): Promise<FinanceKpis> {
  return withTenant(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [salesAgg, expenseAgg, openKassa, customers, suppliers] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: monthStart }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { odenilmis: true },
      }),
      prisma.xercl_r.aggregate({
        where: { tarix: { gte: monthStart } },
        _sum: { mebleg: true },
      }),
      prisma.kassalar.aggregate({
        where: { status: "acig" },
        _sum: { acilis_qaligi: true },
      }),
      // Customer debt (we receive)
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(borc), 0)::float AS total
          FROM kontragentler
         WHERE nov IN ('musteri', 'her_ikisi') AND borc > 0
      `,
      // Supplier debt (we pay) — borc < 0 means we owe them; or positive in supplier's nov
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(ABS(SUM(LEAST(borc, 0))), 0)::float AS total
          FROM kontragentler
         WHERE nov IN ('techizatci', 'her_ikisi')
      `,
    ]);

    const daxil = Number(salesAgg._sum.odenilmis ?? 0);
    const xaric = Number(expenseAgg._sum.mebleg ?? 0);

    // Gizli mod scale tətbiqi — yalnız ekran üçün
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      daxil_bu_ay: daxil * s,
      xaric_bu_ay: xaric * s,
      net_bu_ay: (daxil - xaric) * s,
      kassa_balans: Number(openKassa._sum.acilis_qaligi ?? 0) * s,
      alici_borcu: Number(customers[0]?.total ?? 0) * s,
      techizatci_borcu: Number(suppliers[0]?.total ?? 0) * s,
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

export async function getDashboardKpis(): Promise<DashboardKpis> {
  return withTenant(async () => {
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
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: todayStart }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { odenilmis: true },
      }),
      prisma.xercl_r.aggregate({
        where: { tarix: { gte: todayStart } },
        _sum: { mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: monthStart }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { odenilmis: true, umumi_mebleg: true },
      }),
      prisma.xercl_r.aggregate({
        where: { tarix: { gte: monthStart } },
        _sum: { mebleg: true },
      }),
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(borc), 0)::float AS total FROM kontragentler
         WHERE nov IN ('musteri', 'her_ikisi') AND borc > 0
      `,
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(ABS(SUM(LEAST(borc, 0))), 0)::float AS total FROM kontragentler
         WHERE nov IN ('techizatci', 'her_ikisi')
      `,
      prisma.kassalar.aggregate({
        where: { status: "acig" },
        _sum: { acilis_qaligi: true },
      }),
      prisma.maliye_hesablari.aggregate({
        where: { aktiv: true },
        _sum: { qaliq: true },
      }),
      prisma.finance_operations.count({
        where: { status: "gozleyen_tesdiq" },
      }).catch(() => 0),
    ]);

    const ayGelir = Number(ayslaes._sum.odenilmis ?? 0);
    const ayXerc = Number(ayExp._sum.mebleg ?? 0);
    const ayMenfeet = ayGelir - ayXerc;

    // Gizli mod scale
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      bugun_gelir: Number(bugunSales._sum.odenilmis ?? 0) * s,
      bugun_xerc: Number(bugunExp._sum.mebleg ?? 0) * s,
      bugun_net: (Number(bugunSales._sum.odenilmis ?? 0) - Number(bugunExp._sum.mebleg ?? 0)) * s,
      ay_gelir: ayGelir * s,
      ay_xerc: ayXerc * s,
      ay_menfeet: ayMenfeet * s,
      ay_ebitda: ayMenfeet * s,
      debitor_cem: Number(customers[0]?.total ?? 0) * s,
      kreditor_cem: Number(suppliers[0]?.total ?? 0) * s,
      gozleyen_odenis: Number(gozleyenOp ?? 0),
      hesab_balans:
        (Number(openKassa._sum.acilis_qaligi ?? 0) + Number(hesablar._sum.qaliq ?? 0)) * s,
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
        select: { id: true, ad: true, valyuta: true },
      }).catch(() => [] as { id: string; ad: string; valyuta: string | null }[]),
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
      hesablar: hesablar.map((h) => ({ id: h.id, ad: `${h.ad}${h.valyuta && h.valyuta !== "AZN" ? ` (${h.valyuta})` : ""}` })),
      kontragentler: kontragentler.map((k) => ({ id: k.id, ad: k.ad })),
      iscilier: iscilier.map((i) => ({ id: i.id, ad: i.ad_soyad })),
    };
  });
}

export async function getTopCreditors(limit = 5): Promise<TopRow[]> {
  return withTenant(async () =>
    (await prisma.kontragentler.findMany({
      where: { aktiv: true, nov: { in: ["techizatci", "her_ikisi"] }, borc: { lt: 0 } },
      orderBy: { borc: "asc" },
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
          date_trunc('month', CURRENT_DATE) - INTERVAL '${months - 1} months',
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
};

export async function getExpenses(filter: ExpenseFilter, page = 1, pageSize = 50): Promise<{ items: ExpenseRow[]; total: number }> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter.kateqoriya_id?.length) where.kateqoriya_id = { in: filter.kateqoriya_id };
    if (filter.from || filter.to) {
      where.tarix = {};
      if (filter.from) where.tarix.gte = filter.from;
      if (filter.to) where.tarix.lte = filter.to;
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
};

export async function getDebtors(): Promise<DebtorRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
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
    };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT k.id::text AS id,
             k.ad,
             k.telefon,
             k.whatsapp,
             k.email,
             k.voen,
             COALESCE(k.borc, 0)::float AS borc,
             k.borc_limiti::float AS borc_limiti,
             (SELECT MAX(s.tarix) FROM satis_sifarisleri s
                WHERE s.musteri_id = k.id AND s.sahibkar_id = ${sahibkarId}::uuid
                  AND (s.status IS NULL OR s.status != 'legv')) AS son_alver,
             COALESCE((CURRENT_DATE - (
                SELECT MAX(s2.tarix)::date FROM satis_sifarisleri s2
                  WHERE s2.musteri_id = k.id AND s2.sahibkar_id = ${sahibkarId}::uuid
                    AND (s2.status IS NULL OR s2.status != 'legv')
             ))::int, 0) AS gun_kecdi,
             u.ad_soyad AS menecer_ad,
             k.yenilendi
        FROM kontragentler k
        LEFT JOIN istifadeciler u ON u.id = k.menecer_id
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
         AND k.aktiv = TRUE
         AND k.nov IN ('musteri', 'her_ikisi')
         AND COALESCE(k.borc, 0) > 0
       ORDER BY k.borc DESC NULLS LAST
    `;
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
};

export async function getCreditors(): Promise<CreditorRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
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
    };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT k.id::text AS id,
             k.ad,
             k.telefon,
             k.whatsapp,
             k.email,
             k.voen,
             ABS(COALESCE(k.borc, 0))::float AS borc,
             (SELECT MAX(a.tarix) FROM alis_sifarisleri a
                WHERE a.techiazatci_id = k.id AND a.sahibkar_id = ${sahibkarId}::uuid) AS son_alver,
             COALESCE((CURRENT_DATE - (
                SELECT MAX(a2.tarix)::date FROM alis_sifarisleri a2
                  WHERE a2.techiazatci_id = k.id AND a2.sahibkar_id = ${sahibkarId}::uuid
             ))::int, 0) AS gun_kecdi
        FROM kontragentler k
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
         AND k.aktiv = TRUE
         AND k.nov IN ('techizatci', 'her_ikisi')
         AND COALESCE(k.borc, 0) < 0
       ORDER BY k.borc ASC NULLS LAST
    `;
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
};

export async function getOpenSalesForCustomer(musteri_id: string, limit = 50): Promise<OpenSaleOpt[]> {
  return withTenant(async () => {
    const rows = await prisma.satis_sifarisleri.findMany({
      where: {
        musteri_id,
        status: { not: "legv" },
        qaralama: { not: true },
      },
      orderBy: { tarix: "asc" },
      take: limit,
      select: { id: true, nomre: true, tarix: true, son_mebleg: true, odenilmis: true },
    });
    return rows
      .map((r) => {
        const son = Number(r.son_mebleg ?? 0);
        const od = Number(r.odenilmis ?? 0);
        const qalig = son - od;
        return { id: r.id, nomre: r.nomre, tarix: r.tarix, qalig, son_mebleg: son };
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
        sahibkar_id: sahibkarId,
        status: { in: ["yeni", "tesdiq", "gonderildi"] },
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
      where: { qeyd: { contains: tag } },
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
