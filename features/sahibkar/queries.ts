import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export async function getOwnerDashboard() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [salesAgg, stockValueRow, isciAgg, branchCount, cashRow] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: monthStart }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
      }),
      prisma.$queryRaw<{ deyer: number }[]>`
        SELECT COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0)::float AS deyer
          FROM stok s JOIN mehsullar m ON m.id = s.mehsul_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid
      `,
      prisma.istifadeciler.aggregate({ where: { aktiv: true }, _sum: { aylik_maas: true }, _count: { _all: true } }),
      prisma.filiallar.count({ where: { aktiv: true } }),
      prisma.kassa_emeliyyatlari.aggregate({
        where: { odenis_nov: "negd", tarix: { gte: monthStart } },
        _sum: { mebleg: true },
      }),
    ]);

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      revenue_this_month: Number(salesAgg._sum.son_mebleg ?? 0) * s,
      stock_value: Number(stockValueRow[0]?.deyer ?? 0) * s,
      total_salary: Number(isciAgg._sum.aylik_maas ?? 0) * s,
      isci_count: isciAgg._count._all,
      branch_count: branchCount,
      cash_in_this_month: Number(cashRow._sum.mebleg ?? 0) * s,
    };
  });
}

export async function getCostAnalysis() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [salesRev, cogsRow, opexRow, payrollAgg] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: monthStart }, status: { not: "legv" } },
        _sum: { son_mebleg: true, endirim_mebleg: true },
      }),
      prisma.$queryRaw<{ cogs: number }[]>`
        SELECT COALESCE(SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0)), 0)::float AS cogs
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          JOIN mehsullar m ON m.id = sls.mehsul_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix >= ${monthStart} AND ss.status != 'legv'
      `,
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(mebleg), 0)::float AS total FROM "xerclər"
         WHERE sahibkar_id = ${sahibkarId}::uuid AND tarix >= ${monthStart}
      `,
      prisma.istifadeciler.aggregate({ where: { aktiv: true }, _sum: { aylik_maas: true } }),
    ]);

    const revenue = Number(salesRev._sum.son_mebleg ?? 0);
    const discount = Number(salesRev._sum.endirim_mebleg ?? 0);
    const cogs = Number(cogsRow[0]?.cogs ?? 0);
    const opex = Number(opexRow[0]?.total ?? 0);
    const payroll = Number(payrollAgg._sum.aylik_maas ?? 0);

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      revenue: revenue * s,
      discount_given: discount * s,
      cogs: cogs * s,
      opex: opex * s,
      payroll_monthly: payroll * s,
      gross_profit: (revenue - cogs) * s,
      net_profit: (revenue - cogs - opex - payroll) * s,
      cogs_pct: revenue > 0 ? (cogs / revenue) * 100 : 0,
      opex_pct: revenue > 0 ? (opex / revenue) * 100 : 0,
      payroll_pct: revenue > 0 ? (payroll / revenue) * 100 : 0,
    };
  });
}

export async function getBranchPerformance() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const rows = await prisma.$queryRaw<{
      filial_id: number;
      ad: string;
      sifaris_say: number;
      cemi: number;
      stok_deyer: number;
    }[]>`
      SELECT f.id AS filial_id, f.ad,
             COUNT(ss.id)::int AS sifaris_say,
             COALESCE(SUM(ss.son_mebleg), 0)::float AS cemi,
             (SELECT COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0)::float
                FROM anbarlar a
                LEFT JOIN stok s ON s.anbar_id = a.id
                LEFT JOIN mehsullar m ON m.id = s.mehsul_id
               WHERE a.filial_id = f.id) AS stok_deyer
        FROM filiallar f
        LEFT JOIN satis_sifarisleri ss ON ss.filial_id = f.id
             AND ss.tarix >= ${monthStart} AND ss.status != 'legv' AND ss.qaralama IS NOT TRUE
       WHERE f.sahibkar_id = ${sahibkarId}::uuid AND f.aktiv = TRUE
       GROUP BY f.id, f.ad
       ORDER BY cemi DESC
    `;
    // Gizli mod tətbiqi — branch performans rəqəmləri
    const stealth = await getStealthState();
    if (stealth.aktiv && stealth.scale !== 1) {
      const s = stealth.scale;
      for (const r of rows) {
        r.cemi = Number(r.cemi) * s;
        r.stok_deyer = Number(r.stok_deyer) * s;
      }
    }
    return rows;
  });
}

export type AuditFilter = {
  q?: string;
  emeliyyat?: string;
  resurs_nov?: string;
  status?: string;
  istifadeci_id?: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function getOwnerAuditLog(limit = 30) {
  return withTenant(async () => {
    const rows = await prisma.audit_log.findMany({
      orderBy: { yaradildi: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      tarix: r.yaradildi,
      istifadeci_ad: r.istifadeci_ad,
      emeliyyat: r.emeliyyat,
      resurs_nov: r.resurs_nov,
      resurs_id: r.resurs_id,
      ip_adres: r.ip_adres,
    }));
  });
}

export type DetailedAuditRow = {
  id: string;
  tarix: Date | null;
  istifadeci_id: string | null;
  istifadeci_ad: string | null;
  emeliyyat: string;
  resurs_nov: string;
  resurs_id: string | null;
  ip_adres: string | null;
  user_agent: string | null;
  url: string | null;
  metod: string | null;
  status: string | null;
  sebeb: string | null;
  brauzer: string | null;
  os: string | null;
  cihaz: string | null;
  evvelki_data: unknown;
  yeni_data: unknown;
};

/** Filtered, detailed audit query for the sahibkar audit page. */
export async function getDetailedAuditLog(f: AuditFilter = {}): Promise<DetailedAuditRow[]> {
  return withTenant(async () => {
    const rows = await prisma.audit_log.findMany({
      where: {
        ...(f.emeliyyat ? { emeliyyat: f.emeliyyat } : {}),
        ...(f.resurs_nov ? { resurs_nov: f.resurs_nov } : {}),
        ...(f.status ? { status: f.status } : {}),
        ...(f.istifadeci_id ? { istifadeci_id: f.istifadeci_id } : {}),
        ...(f.from || f.to ? { yaradildi: { gte: f.from, lte: f.to } } : {}),
        ...(f.q
          ? {
              OR: [
                { istifadeci_ad: { contains: f.q, mode: "insensitive" } },
                { resurs_nov: { contains: f.q, mode: "insensitive" } },
                { emeliyyat: { contains: f.q, mode: "insensitive" } },
                { url: { contains: f.q, mode: "insensitive" } },
                { sebeb: { contains: f.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { yaradildi: "desc" },
      take: f.limit ?? 100,
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      tarix: r.yaradildi,
      istifadeci_id: r.istifadeci_id,
      istifadeci_ad: r.istifadeci_ad,
      emeliyyat: r.emeliyyat,
      resurs_nov: r.resurs_nov,
      resurs_id: r.resurs_id,
      ip_adres: r.ip_adres,
      user_agent: r.user_agent,
      url: r.url,
      metod: r.metod,
      status: r.status,
      sebeb: r.sebeb,
      brauzer: r.brauzer,
      os: r.os,
      cihaz: r.cihaz,
      evvelki_data: r.evvelki_data,
      yeni_data: r.yeni_data,
    }));
  });
}

export type AuditFacets = {
  emeliyyat: { value: string; count: number }[];
  resurs_nov: { value: string; count: number }[];
  status: { value: string; count: number }[];
  total: number;
};

export async function getAuditFacets(): Promise<AuditFacets> {
  return withTenant(async () => {
    const [em, rn, st, tot] = await Promise.all([
      prisma.audit_log.groupBy({ by: ["emeliyyat"], _count: { _all: true }, orderBy: { _count: { emeliyyat: "desc" } }, take: 20 }),
      prisma.audit_log.groupBy({ by: ["resurs_nov"], _count: { _all: true }, orderBy: { _count: { resurs_nov: "desc" } }, take: 20 }),
      prisma.audit_log.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.audit_log.count(),
    ]);
    return {
      emeliyyat: em.map((r) => ({ value: r.emeliyyat, count: r._count._all })),
      resurs_nov: rn.map((r) => ({ value: r.resurs_nov, count: r._count._all })),
      status: st.map((r) => ({ value: r.status ?? "—", count: r._count._all })),
      total: tot,
    };
  });
}
