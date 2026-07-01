import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export async function getEmployeeFullDetail(id: string) {
  return withTenant(async () => {
    // Soft-delete guard: silinmiş işçinin detalı açılmamalı (notFound axını).
    return prisma.istifadeciler.findFirst({
      where: { id, deleted_at: null },
      include: {
        roles: { select: { ad: true } },
        filiallar_istifadeciler_default_filial_idTofiliallar: { select: { ad: true } },
      },
    });
  });
}

export async function getEmployeeSales(id: string, limit = 20) {
  return withTenant(async () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [agg, recent, monthAgg] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { satis_meneceri_id: id, status: { not: "legv" } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.findMany({
        where: { satis_meneceri_id: id, status: { not: "legv" } },
        orderBy: { tarix: "desc" },
        take: limit,
        include: { kontragentler: { select: { ad: true } } },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { satis_meneceri_id: id, status: { not: "legv" }, tarix: { gte: monthStart } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
    ]);

    // Calc tenant-wide average for sales
    const { sahibkarId } = requireTenant();
    const allMonth = await prisma.satis_sifarisleri.aggregate({
      where: { sahibkar_id: sahibkarId, status: { not: "legv" }, tarix: { gte: monthStart } },
      _sum: { son_mebleg: true },
      _count: { _all: true },
    });
    const tenantAvg = (allMonth._count._all > 0) ? Number(allMonth._sum.son_mebleg ?? 0) / allMonth._count._all : 0;
    const empAvg = (monthAgg._count._all > 0) ? Number(monthAgg._sum.son_mebleg ?? 0) / monthAgg._count._all : 0;

    return {
      total_count: agg._count._all,
      total_amount: Number(agg._sum.son_mebleg ?? 0),
      month_count: monthAgg._count._all,
      month_amount: Number(monthAgg._sum.son_mebleg ?? 0),
      tenant_month_avg: tenantAvg,
      employee_avg_ticket: empAvg,
      recent: recent.map((s) => ({
        id: s.id,
        nomre: s.nomre,
        tarix: s.tarix,
        son_mebleg: Number(s.son_mebleg ?? 0),
        musteri: s.kontragentler?.ad ?? null,
      })),
    };
  });
}

export async function getEmployeeAttendance(id: string, monthStr?: string) {
  return withTenant(async () => {
    let start: Date;
    let end: Date;
    if (monthStr) {
      const [y, m] = monthStr.split("-").map(Number);
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 1);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    const rows = await prisma.davamiyyet.findMany({
      where: { istifadeci_id: id, tarix: { gte: start, lt: end } },
      orderBy: { tarix: "desc" },
    });
    const total = rows.length;
    const gec = rows.filter((r) => r.gec_dq && r.gec_dq > 0).length;
    const qaib = rows.filter((r) => r.status === "qaib" || !r.giris_saat).length;
    return {
      total,
      gec,
      qaib,
      rows: rows.map((r) => ({
        id: r.id.toString(),
        tarix: r.tarix,
        giris: r.giris_saat,
        cixis: r.cixis_saat,
        gozlenen_giris: r.gozlenen_giris,
        gozlenen_cixis: r.gozlenen_cixis,
        gec_dq: r.gec_dq ?? 0,
        status: r.status ?? "qaydasinda",
        qeyd: r.qeyd,
      })),
    };
  });
}

export async function getEmployeeBordroHistory(id: string, limit = 12) {
  return withTenant(async () => {
    // 🔒 Maaş/bordro həssasdır — icazə (maas.view) və ya öz məlumatı olmalıdır.
    const { canViewSalary } = await import("./access-guard");
    if (!(await canViewSalary(id))) return { total: 0, avg: 0, bonus: 0, cerime: 0, rows: [] };
    const rows = await prisma.maas_hesablamalar.findMany({
      where: { istifadeci_id: id },
      orderBy: [{ il: "desc" }, { ay: "desc" }],
      take: limit,
    });
    const total = rows.reduce((s, r) => s + Number(r.son_meblegh ?? 0), 0);
    const avg = rows.length ? total / rows.length : 0;
    const bonus = rows.reduce((s, r) => s + Number(r.kpi_bonus ?? 0) + Number(r.manual_bonus ?? 0), 0);
    const cerime = rows.reduce((s, r) => s + Number(r.cerime ?? 0), 0);
    return {
      total,
      avg,
      bonus,
      cerime,
      rows: rows.map((r) => ({
        id: r.id,
        il: r.il,
        ay: r.ay,
        esas_maas: Number(r.esas_maas ?? 0),
        prorata_maas: Number(r.prorata_maas ?? 0),
        avans: Number(r.avans ?? 0),
        ish_gun_norma: r.ish_gun_norma,
        ish_gun_faktiki: r.ish_gun_faktiki,
        qaib_gun: r.qaib_gun,
        mezuniyyet_gun: r.mezuniyyet_gun,
        son_meblegh: Number(r.son_meblegh ?? 0),
        kpi_bonus: Number(r.kpi_bonus ?? 0),
        manual_bonus: Number(r.manual_bonus ?? 0),
        cerime: Number(r.cerime ?? 0),
        status: r.status ?? "cernovik",
        odenish_tarixi: r.odenish_tarixi,
        detal: (r.detal as { satis_komisyon?: number; vergi?: number; sosial_sigorta?: number; gross?: number; events?: Array<{ ts?: string; nov?: string; meblegh?: number; sebeb?: string }> } | null) ?? null,
      })),
    };
  });
}

export async function getEmployeeLeaves(id: string) {
  return withTenant(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yearStart = new Date(today.getFullYear(), 0, 1);

    const [past, upcoming] = await Promise.all([
      prisma.isci_mezuniyyet.findMany({
        where: {
          istifadeci_id: id,
          bitme: { lt: today },
          status: "tesdiq",
        },
        orderBy: { baslama: "desc" },
        take: 20,
      }),
      prisma.isci_mezuniyyet.findMany({
        where: { istifadeci_id: id, baslama: { gte: today } },
        orderBy: { baslama: "asc" },
        take: 10,
      }),
    ]);

    const yearUsedAgg = await prisma.isci_mezuniyyet.aggregate({
      where: {
        istifadeci_id: id,
        status: "tesdiq",
        baslama: { gte: yearStart },
      },
      _sum: { gun_sayi: true },
    });
    const used = Number(yearUsedAgg._sum.gun_sayi ?? 0);
    const quota = 21; // default annual leave AZ standard
    return {
      quota,
      used,
      remaining: Math.max(0, quota - used),
      past,
      upcoming,
    };
  });
}

export async function getEmployeeTasks(id: string) {
  return withTenant(async () => {
    const rows = await prisma.tapshiriqlar.findMany({
      where: { mesul_id: id },
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
      take: 30,
      select: {
        id: true,
        basliq: true,
        status: true,
        prioritet: true,
        deadline: true,
        yaradildi: true,
        tamamlandi_de: true,
      },
    });
    return rows;
  });
}

export type BonusPenaltyEvent = {
  ts: Date;
  nov: "bonus" | "cerime";
  meblegh: number;
  sebeb: string;
  bordro_id: number;
  il: number;
  ay: number;
};

export async function getEmployeeBonusEvents(id: string, limit = 100): Promise<BonusPenaltyEvent[]> {
  return withTenant(async () => {
    // 🔒 Bonus/cərimə məbləğləri həssasdır — icazə (maas.view) və ya öz məlumatı.
    const { canViewSalary } = await import("./access-guard");
    if (!(await canViewSalary(id))) return [];
    const rows = await prisma.maas_hesablamalar.findMany({
      where: { istifadeci_id: id },
      orderBy: [{ il: "desc" }, { ay: "desc" }],
      take: limit,
      select: { id: true, il: true, ay: true, detal: true },
    });
    const out: BonusPenaltyEvent[] = [];
    for (const r of rows) {
      const detal = r.detal as { events?: Array<{ ts?: string; nov?: string; meblegh?: number; sebeb?: string }> } | null;
      const events = detal?.events ?? [];
      for (const e of events) {
        if (e.nov !== "bonus" && e.nov !== "cerime") continue;
        out.push({
          ts: e.ts ? new Date(e.ts) : new Date(0),
          nov: e.nov as "bonus" | "cerime",
          meblegh: Number(e.meblegh ?? 0),
          sebeb: String(e.sebeb ?? ""),
          bordro_id: r.id,
          il: r.il,
          ay: r.ay,
        });
      }
    }
    return out.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  });
}

export async function getEmployeeAuditLog(id: string, limit = 30) {
  return withTenant(async () => {
    const rows = await prisma.audit_log.findMany({
      where: { istifadeci_id: id },
      orderBy: { yaradildi: "desc" },
      take: limit,
      select: {
        id: true,
        emeliyyat: true,
        resurs_nov: true,
        resurs_id: true,
        url: true,
        metod: true,
        status: true,
        yaradildi: true,
      },
    });
    return rows.map((r) => ({ ...r, id: r.id.toString() }));
  });
}
