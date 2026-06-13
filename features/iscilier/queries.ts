import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { EmployeeRow, EmployeeStatus, FilialOpt, RoleOpt } from "./types";

export type EmployeeFilter = {
  search?: string;
  rol_id?: number[];
  filial_id?: number[];
  vezife?: string[];
  status?: EmployeeStatus[];
  aktiv?: boolean;
  /** Aylıq maaş aralığı (₼) */
  maas_min?: number;
  maas_max?: number;
  /** İşə qəbul (ise_baslama) tarix aralığı (ISO yyyy-mm-dd) */
  ise_baslama_min?: string;
  ise_baslama_max?: string;
  /** Soft-delete standart filter */
  recordStatus?: "aktiv" | "silinmis" | "hamisi";
};

function dayStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function getOnLeaveIds(): Promise<Set<string>> {
  try {
    const today = dayStart();
    const rows = await prisma.isci_mezuniyyet.findMany({
      where: { baslama: { lte: today }, bitme: { gte: today }, status: "tesdiq" },
      select: { istifadeci_id: true },
    });
    return new Set(rows.map((r) => r.istifadeci_id));
  } catch {
    return new Set();
  }
}

export async function getEmployees(filter: EmployeeFilter): Promise<EmployeeRow[]> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    const rs = filter.recordStatus ?? "aktiv";
    if (rs === "aktiv") where.deleted_at = null;
    else if (rs === "silinmis") where.deleted_at = { not: null };
    if (filter.aktiv !== undefined) where.aktiv = filter.aktiv;
    if (filter.rol_id?.length) where.rol_id = { in: filter.rol_id };
    if (filter.vezife?.length) where.vezife = { in: filter.vezife };
    if (filter.filial_id?.length) where.default_filial_id = { in: filter.filial_id };
    if (filter.maas_min !== undefined || filter.maas_max !== undefined) {
      const maas: { gte?: number; lte?: number } = {};
      if (filter.maas_min !== undefined) maas.gte = filter.maas_min;
      if (filter.maas_max !== undefined) maas.lte = filter.maas_max;
      where.aylik_maas = maas;
    }
    if (filter.ise_baslama_min || filter.ise_baslama_max) {
      const ise: { gte?: Date; lte?: Date } = {};
      if (filter.ise_baslama_min) {
        const d = new Date(filter.ise_baslama_min);
        if (!Number.isNaN(d.getTime())) ise.gte = d;
      }
      if (filter.ise_baslama_max) {
        const d = new Date(filter.ise_baslama_max);
        if (!Number.isNaN(d.getTime())) ise.lte = d;
      }
      if (ise.gte || ise.lte) where.ise_baslama = ise;
    }
    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { ad_soyad: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { telefon: { contains: q } },
        { vezife: { contains: q, mode: "insensitive" } },
        { fin_kod: { contains: q, mode: "insensitive" } },
        { isci_kod: { contains: q, mode: "insensitive" } },
      ];
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [rows, onLeave, salesAgg, attAgg] = await Promise.all([
      prisma.istifadeciler.findMany({
        where,
        orderBy: { ad_soyad: "asc" },
        include: {
          roles: { select: { ad: true } },
          filiallar_istifadeciler_default_filial_idTofiliallar: { select: { id: true, ad: true } },
        },
      }),
      getOnLeaveIds(),
      prisma.satis_sifarisleri
        .groupBy({
          by: ["satis_meneceri_id"],
          where: {
            status: { not: "legv" },
            tarix: { gte: monthStart, lt: monthEnd },
            satis_meneceri_id: { not: null },
          },
          _sum: { son_mebleg: true },
          _count: { _all: true },
        })
        .catch(() => []),
      prisma.davamiyyet
        .groupBy({
          by: ["istifadeci_id", "status"],
          where: { tarix: { gte: monthStart, lt: monthEnd } },
          _count: { _all: true },
        })
        .catch(() => []),
    ]);

    const salesMap = new Map<string, number>();
    for (const s of salesAgg) {
      if (s.satis_meneceri_id) salesMap.set(s.satis_meneceri_id, Number(s._sum.son_mebleg ?? 0));
    }
    const attTotal = new Map<string, { total: number; present: number }>();
    for (const a of attAgg) {
      const cur = attTotal.get(a.istifadeci_id) ?? { total: 0, present: 0 };
      cur.total += a._count._all;
      if (a.status !== "qaib") cur.present += a._count._all;
      attTotal.set(a.istifadeci_id, cur);
    }

    const items = rows.map<EmployeeRow>((r) => {
      const status: EmployeeStatus = r.isden_cixdi
        ? "cixib"
        : !r.aktiv
        ? "passiv"
        : onLeave.has(r.id)
        ? "mezuniyyetde"
        : "aktiv";
      const monthSales = salesMap.get(r.id) ?? 0;
      const att = attTotal.get(r.id);
      const attPct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
      // Target: simple heuristic — 5x monthly salary
      const target = Number(r.aylik_maas ?? 0) * 5;
      const targetPct = target > 0 ? Math.round((monthSales / target) * 100) : null;
      return {
        id: r.id,
        ad_soyad: r.ad_soyad,
        email: r.email,
        telefon: r.telefon,
        rol_id: r.rol_id ?? 0,
        rol_ad: r.roles?.ad ?? "—",
        vezife: r.vezife,
        aylik_maas: Number(r.aylik_maas ?? 0),
        ise_baslama: r.ise_baslama,
        aktiv: r.aktiv ?? true,
        son_giris: r.son_giris,
        isden_cixdi: r.isden_cixdi,
        fin_kod: r.fin_kod,
        dogum_tarixi: r.dogum_tarixi,
        unvan: r.unvan,
        bank_hesab: r.bank_hesab,
        bank_ad: r.bank_ad,
        default_filial_id: r.default_filial_id,
        default_filial_ad: r.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? null,
        profil_sekil: r.profil_sekil,
        status,
        month_sales: monthSales,
        attendance_pct: attPct,
        target_pct: targetPct,
      };
    });

    if (filter.status?.length) {
      const set = new Set(filter.status);
      return items.filter((i) => set.has(i.status));
    }
    return items;
  });
}

export async function getEmployeeStats() {
  return withTenant(async () => {
    const today = dayStart();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const threeMonthAgo = new Date(today);
    threeMonthAgo.setMonth(threeMonthAgo.getMonth() - 3);

    const [total, aktiv, salaryAgg, onLeaveToday, newThisMonth, leftLast3M] = await Promise.all([
      // Soft-delete standart: silinmiş işçilər saylara daxil olmamalı.
      prisma.istifadeciler.count({ where: { deleted_at: null } }),
      prisma.istifadeciler.count({ where: { aktiv: true, isden_cixdi: null, deleted_at: null } }),
      prisma.istifadeciler.aggregate({
        where: { aktiv: true, isden_cixdi: null, deleted_at: null },
        _sum: { aylik_maas: true },
      }),
      prisma.isci_mezuniyyet
        .count({ where: { baslama: { lte: today }, bitme: { gte: today }, status: "tesdiq" } })
        .catch(() => 0),
      prisma.istifadeciler.count({ where: { ise_baslama: { gte: monthStart }, deleted_at: null } }),
      prisma.istifadeciler.count({ where: { isden_cixdi: { gte: threeMonthAgo }, deleted_at: null } }),
    ]);

    return {
      total,
      aktiv,
      passiv: total - aktiv,
      maas_cemi: Number(salaryAgg._sum.aylik_maas ?? 0),
      mezuniyyetde: onLeaveToday,
      bu_ay_yeni: newThisMonth,
      isden_cixanlar: leftLast3M,
    };
  });
}

export async function getRoleOptions(): Promise<RoleOpt[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.roles.findMany({
      where: { OR: [{ sahibkar_id: sahibkarId }, { sistem: true }] },
      orderBy: { ad: "asc" },
    });
    return rows.map((r) => ({ id: r.id, ad: r.ad }));
  });
}

export async function getFilialOptions(): Promise<FilialOpt[]> {
  return withTenant(async () => {
    const rows = await prisma.filiallar.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    });
    return rows.map((r) => ({ id: r.id, ad: r.ad }));
  });
}

export async function getVezifeOptions(): Promise<string[]> {
  return withTenant(async () => {
    const rows = await prisma.vezifeler.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
      select: { ad: true },
    });
    return rows.map((r) => r.ad);
  });
}

export type VezifeRow = { id: number; ad: string; aktiv: boolean; istifade_sayi: number };

export async function getAllVezifeler(): Promise<VezifeRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      Array<{ id: number; ad: string; aktiv: boolean; istifade_sayi: bigint }>
    >`
      SELECT v.id, v.ad, v.aktiv,
             COUNT(u.id)::bigint AS istifade_sayi
        FROM vezifeler v
        LEFT JOIN istifadeciler u
          ON u.sahibkar_id = v.sahibkar_id
         AND LOWER(u.vezife) = LOWER(v.ad)
         AND u.aktiv = TRUE
       WHERE v.sahibkar_id = ${sahibkarId}::uuid
       GROUP BY v.id, v.ad, v.aktiv
       ORDER BY v.aktiv DESC, v.ad ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      aktiv: r.aktiv,
      istifade_sayi: Number(r.istifade_sayi),
    }));
  });
}

export async function getEmployeeDetail(id: string) {
  return withTenant(async () => {
    return prisma.istifadeciler.findUnique({
      where: { id },
      include: {
        roles: { select: { ad: true } },
        filiallar_istifadeciler_default_filial_idTofiliallar: { select: { ad: true } },
      },
    });
  });
}

export async function getLeaveRequests(filter?: { status?: string; month?: string }) {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter?.status && filter.status !== "all") where.status = filter.status;
    if (filter?.month) {
      const [y, m] = filter.month.split("-").map(Number);
      if (y && m) {
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        where.OR = [
          { baslama: { gte: start, lt: end } },
          { bitme: { gte: start, lt: end } },
        ];
      }
    }
    const rows = await prisma.isci_mezuniyyet.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 200,
      include: {
        istifadeciler_isci_mezuniyyet_istifadeci_idToistifadeciler: { select: { ad_soyad: true } },
        istifadeciler_isci_mezuniyyet_tesdiq_eden_idToistifadeciler: { select: { ad_soyad: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      istifadeci_id: r.istifadeci_id,
      istifadeci_ad: r.istifadeciler_isci_mezuniyyet_istifadeci_idToistifadeciler?.ad_soyad ?? "—",
      nov: r.nov,
      baslama: r.baslama,
      bitme: r.bitme,
      gun_sayi: r.gun_sayi,
      sebeb: r.sebeb,
      status: r.status,
      tesdiq_eden: r.istifadeciler_isci_mezuniyyet_tesdiq_eden_idToistifadeciler?.ad_soyad ?? null,
      tesdiq_qeyd: r.tesdiq_qeyd,
      yaradildi: r.yaradildi,
    }));
  });
}

/** Returns per-leave-type day balance for current year, summed across active employees. */
export async function getLeaveBalances() {
  return withTenant(async () => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const yearEnd = new Date(new Date().getFullYear() + 1, 0, 1);
    const grouped = await prisma.isci_mezuniyyet
      .groupBy({
        by: ["nov", "status"],
        where: { baslama: { gte: yearStart, lt: yearEnd } },
        _sum: { gun_sayi: true },
      })
      .catch(() => []);
    const result: Record<string, { tesdiq: number; gozleyir: number; red: number }> = {};
    for (const g of grouped) {
      result[g.nov] = result[g.nov] ?? { tesdiq: 0, gozleyir: 0, red: 0 };
      const key = (g.status ?? "gozleyir") as keyof (typeof result)[string];
      if (key === "tesdiq" || key === "gozleyir" || key === "red") {
        result[g.nov][key] = Number(g._sum.gun_sayi ?? 0);
      }
    }
    return result;
  });
}

export async function getLeaveStats() {
  return withTenant(async () => {
    const today = dayStart();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [pending, monthCount, allMonth] = await Promise.all([
      prisma.isci_mezuniyyet.count({ where: { status: "gozleyir" } }),
      prisma.isci_mezuniyyet.count({ where: { baslama: { gte: monthStart, lt: monthEnd } } }),
      prisma.isci_mezuniyyet.aggregate({
        where: { baslama: { gte: monthStart, lt: monthEnd } },
        _sum: { gun_sayi: true },
      }),
    ]);
    return {
      gozleyir: pending,
      bu_ay_say: monthCount,
      bu_ay_gun: Number(allMonth._sum.gun_sayi ?? 0),
    };
  });
}
