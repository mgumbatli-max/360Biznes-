import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

/** Hub snapshot — bugünkü cəmi satış, mənfəət, yeni müştəri, kassa, açıq tapşırıq */
export async function getOwnerHubSnapshot() {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todaySales, todayCash, newCustomers, openTasks, monthSales, payrollAgg] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: dayStart }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.kassa_emeliyyatlari.aggregate({
        where: { tarix: { gte: dayStart } },
        _sum: { mebleg: true },
      }),
      prisma.kontragentler.count({
        where: { yaradildi: { gte: dayStart } },
      }).catch(() => 0),
      prisma.sahibkar_tapshiriq.count({
        where: { sahibkar_id: sahibkarId, status: { in: ["acig", "isleyir"] } },
      }).catch(() => 0),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: monthStart }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.istifadeciler.aggregate({ where: { aktiv: true }, _sum: { aylik_maas: true }, _count: { _all: true } }),
    ]);

    const monthRevenue = Number(monthSales._sum.son_mebleg ?? 0);
    const orderCount = monthSales._count._all ?? 0;
    const avgTicket = orderCount > 0 ? monthRevenue / orderCount : 0;
    void istifadeciId;

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      today_revenue: Number(todaySales._sum.son_mebleg ?? 0) * s,
      today_orders: todaySales._count._all ?? 0,
      today_cash: Number(todayCash._sum.mebleg ?? 0) * s,
      today_new_customers: newCustomers,
      open_tasks: openTasks,
      month_revenue: monthRevenue * s,
      avg_ticket: avgTicket * s,
      active_isci: payrollAgg._count._all,
      payroll_monthly: Number(payrollAgg._sum.aylik_maas ?? 0) * s,
    };
  });
}

export async function getOwnerNotes(limit = 50) {
  return withTenant(async () => {
    const rows = await prisma.sahibkar_qeyd.findMany({
      orderBy: [{ pinned: "desc" }, { yaradildi: "desc" }],
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      basliq: r.basliq,
      metn: r.metn,
      reng: r.reng,
      pinned: !!r.pinned,
      link_nov: r.link_nov,
      link_id: r.link_id,
      link_label: r.link_label,
      yaradildi: r.yaradildi,
      yenilendi: r.yenilendi,
    }));
  });
}

export async function getOwnerTasks(limit = 50) {
  return withTenant(async () => {
    const rows = await prisma.sahibkar_tapshiriq.findMany({
      orderBy: [{ status: "asc" }, { tarix: "asc" }],
      take: limit,
      include: { istifadeciler: { select: { id: true, ad_soyad: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      basliq: r.basliq,
      tesvir: r.tesvir,
      tarix: r.tarix,
      prioritet: r.prioritet,
      status: r.status,
      mesul_ad: r.istifadeciler?.ad_soyad ?? null,
      link_nov: r.link_nov,
      link_id: r.link_id,
      link_label: r.link_label,
      yaradildi: r.yaradildi,
    }));
  });
}

export async function getOwnerEmployees() {
  return withTenant(async () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const employees = await prisma.istifadeciler.findMany({
      where: { aktiv: true },
      select: {
        id: true,
        ad_soyad: true,
        email: true,
        vezife: true,
        profil_sekil: true,
        aylik_maas: true,
        ise_baslama: true,
      },
      orderBy: { ad_soyad: "asc" },
    });
    if (employees.length === 0) return [];

    const ids = employees.map((e) => e.id);
    const sales = await prisma.satis_sifarisleri.groupBy({
      by: ["yaradan_id"],
      where: { tarix: { gte: monthStart }, status: { not: "legv" }, yaradan_id: { in: ids } },
      _sum: { son_mebleg: true },
      _count: { _all: true },
    });
    const salesMap = new Map(sales.map((s) => [s.yaradan_id, s]));

    const stealth = await getStealthState();
    const k = stealth.aktiv ? stealth.scale : 1;

    return employees.map((e) => {
      const s = salesMap.get(e.id);
      return {
        id: e.id,
        ad_soyad: e.ad_soyad,
        email: e.email,
        vezife: e.vezife,
        profil_sekil: e.profil_sekil,
        aylik_maas: Number(e.aylik_maas ?? 0) * k,
        ise_baslama: e.ise_baslama,
        month_sales: Number(s?._sum.son_mebleg ?? 0) * k,
        month_orders: s?._count._all ?? 0,
      };
    });
  });
}

export async function getOwnerBranches() {
  return withTenant(async () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const branches = await prisma.filiallar.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
      include: {
        istifadeciler_filiallar_cavabdeh_idToistifadeciler: { select: { ad_soyad: true } },
      },
    });
    if (branches.length === 0) return [];

    const ids = branches.map((b) => b.id);
    const salesAgg = await prisma.satis_sifarisleri.groupBy({
      by: ["filial_id"],
      where: { tarix: { gte: monthStart }, status: { not: "legv" }, filial_id: { in: ids } },
      _sum: { son_mebleg: true },
      _count: { _all: true },
    });
    const filialMap = new Map(salesAgg.map((s) => [s.filial_id, s]));

    const isciCounts = await prisma.istifadeci_filial.groupBy({
      by: ["filial_id"],
      where: { filial_id: { in: ids } },
      _count: { _all: true },
    });
    const isciMap = new Map(isciCounts.map((i) => [i.filial_id, i._count._all]));

    const stealth = await getStealthState();
    const k = stealth.aktiv ? stealth.scale : 1;

    return branches.map((b) => ({
      id: b.id,
      ad: b.ad,
      unvan: b.unvan,
      telefon: b.telefon,
      tip: b.tip,
      seh_r: b.seh_r,
      cavabdeh_ad: b.istifadeciler_filiallar_cavabdeh_idToistifadeciler?.ad_soyad ?? null,
      month_sales: Number(filialMap.get(b.id)?._sum.son_mebleg ?? 0) * k,
      month_orders: filialMap.get(b.id)?._count._all ?? 0,
      isci_count: isciMap.get(b.id) ?? 0,
    }));
  });
}

export async function getBranchDetail(filialId: number) {
  return withTenant(async () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const branch = await prisma.filiallar.findFirst({
      where: { id: filialId },
      include: {
        istifadeciler_filiallar_cavabdeh_idToistifadeciler: { select: { id: true, ad_soyad: true, email: true } },
      },
    });
    if (!branch) return null;

    const [sales, expenses, users] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { filial_id: filialId, tarix: { gte: monthStart }, status: { not: "legv" } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(mebleg), 0)::float AS total FROM "xerclər"
        WHERE filial_id = ${filialId} AND tarix >= ${monthStart}
      `.catch(() => [{ total: 0 }]),
      prisma.istifadeci_filial.findMany({
        where: { filial_id: filialId },
        include: { istifadeciler: { select: { id: true, ad_soyad: true, vezife: true } } },
      }),
    ]);

    return {
      branch,
      sales_total: Number(sales._sum.son_mebleg ?? 0),
      sales_count: sales._count._all,
      expenses_total: Number(expenses[0]?.total ?? 0),
      users: users.map((u) => u.istifadeciler).filter(Boolean),
    };
  });
}

export async function getOwnerPartiyas() {
  return withTenant(async () => {
    const rows = await prisma.sahibkar_partiya.findMany({
      orderBy: [{ tarix: "desc" }],
      take: 50,
      include: {
        sahibkar_techizatci: { select: { ad: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      olke: r.olke,
      tarix: r.tarix,
      status: r.status,
      valyuta: r.valyuta,
      cemi_real_maya_azn: Number(r.cemi_real_maya_azn ?? 0),
      cemi_xerc_azn: Number(r.cemi_xerc_azn ?? 0),
      techizatci_ad: r.sahibkar_techizatci?.ad ?? null,
    }));
  });
}

export async function getOwnerSnapshots(limit = 30) {
  return withTenant(async () => {
    const rows = await prisma.sahibkar_snapshot.findMany({
      where: { obyekt_nov: "gunluk" },
      orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      tarix: r.tarix,
      basliq: r.basliq,
      mebleg: Number(r.mebleg ?? 0),
      snapshot_json: r.snapshot_json,
      yaradildi: r.yaradildi,
    }));
  });
}

export async function getDataHealth() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [negativeStock, dupCustomers, noImage, noCost] = await Promise.all([
      prisma.$queryRaw<{ c: number }[]>`
        SELECT COUNT(*)::int AS c FROM stok WHERE sahibkar_id = ${sahibkarId}::uuid AND miqdar < 0
      `.catch(() => [{ c: 0 }]),
      prisma.$queryRaw<{ c: number }[]>`
        SELECT COUNT(*)::int AS c FROM (
          SELECT telefon FROM kontragentler WHERE sahibkar_id = ${sahibkarId}::uuid AND telefon IS NOT NULL
          GROUP BY telefon HAVING COUNT(*) > 1
        ) d
      `.catch(() => [{ c: 0 }]),
      prisma.mehsullar.count({ where: { OR: [{ sekil_url: null }, { sekil_url: "" }], aktiv: true } }).catch(() => 0),
      prisma.mehsullar.count({ where: { OR: [{ alish_qiymeti: 0 }, { alish_qiymeti: null }], aktiv: true } }).catch(() => 0),
    ]);

    return [
      { kod: "neqativ_stok", ad: "Stok mənfi olan məhsullar", say: negativeStock[0]?.c ?? 0, prioritet: "yuksek" as const, hed_link: "/anbar/stok" },
      { kod: "dublikat_musteri", ad: "Eyni telefonla dublikat müştəri", say: dupCustomers[0]?.c ?? 0, prioritet: "orta" as const, hed_link: "/crm" },
      { kod: "seki_olmayan", ad: "Şəkilsiz aktiv məhsul", say: noImage, prioritet: "asagi" as const, hed_link: "/anbar/mehsul" },
      { kod: "mayadan_yox", ad: "Maya dəyəri olmayan məhsul", say: noCost, prioritet: "yuksek" as const, hed_link: "/anbar/mehsul" },
    ];
  });
}

export async function getOwnerBranchComparison() {
  return withTenant(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const branches = await prisma.filiallar.findMany({ where: { aktiv: true }, select: { id: true, ad: true } });
    if (branches.length === 0) return [];

    const ids = branches.map((b) => b.id);
    const [thisMonth, lastMonth, isciCounts] = await Promise.all([
      prisma.satis_sifarisleri.groupBy({
        by: ["filial_id"],
        where: { filial_id: { in: ids }, tarix: { gte: monthStart }, status: { not: "legv" } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.groupBy({
        by: ["filial_id"],
        where: { filial_id: { in: ids }, tarix: { gte: prevMonthStart, lte: prevMonthEnd }, status: { not: "legv" } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.istifadeciler.groupBy({
        by: ["default_filial_id"],
        where: { default_filial_id: { in: ids }, aktiv: true },
        _count: { _all: true },
      }).catch(() => [] as { default_filial_id: number | null; _count: { _all: number } }[]),
    ]);
    const a = new Map(thisMonth.map((r) => [r.filial_id, { sum: Number(r._sum.son_mebleg ?? 0), n: r._count._all }]));
    const b = new Map(lastMonth.map((r) => [r.filial_id, { sum: Number(r._sum.son_mebleg ?? 0), n: r._count._all }]));
    const isci = new Map(isciCounts.map((r) => [r.default_filial_id, r._count._all] as const));

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return branches.map((br) => {
      const cur = a.get(br.id) ?? { sum: 0, n: 0 };
      const prev = b.get(br.id) ?? { sum: 0, n: 0 };
      const buAy = cur.sum * s;
      const avgTicket = cur.n > 0 ? buAy / cur.n : 0;
      return {
        id: br.id,
        ad: br.ad,
        bu_ay: buAy,
        kecen_ay: prev.sum * s,
        sifaris_say: cur.n,
        kecen_sifaris_say: prev.n,
        orta_cek: avgTicket,
        isci_say: isci.get(br.id) ?? 0,
      };
    });
  });
}

export async function getStaffOptions() {
  return withTenant(async () => {
    const rows = await prisma.istifadeciler.findMany({
      where: { aktiv: true },
      select: { id: true, ad_soyad: true },
      orderBy: { ad_soyad: "asc" },
    });
    return rows;
  });
}

/** Read the snapshot cron toggle from ayarlar. */
export async function getSnapshotCronAktiv(): Promise<boolean> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: "snapshot_cron", acar: "aktiv" },
    });
    return row?.deyer === "true";
  });
}

/** Read comments stored as JSON in sahibkar_tapshiriq.qeyd field. */
export async function getTaskComments(taskId: number) {
  return withTenant(async () => {
    const row = await prisma.sahibkar_tapshiriq.findUnique({ where: { id: taskId }, select: { qeyd: true } });
    if (!row?.qeyd) return [] as Array<{ at: string; user: string | null; text: string }>;
    try {
      const parsed = JSON.parse(row.qeyd);
      if (!Array.isArray(parsed)) return [];
      return parsed as Array<{ at: string; user: string | null; text: string }>;
    } catch {
      return [];
    }
  });
}

/** Last 30-day revenue trend per branch (one bucket per day). */
export async function getOwnerBranchTrend30() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);

    type Row = { filial_id: number; gun: Date; mebleg: number };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT filial_id, date_trunc('day', tarix)::date AS gun, COALESCE(SUM(son_mebleg), 0)::float AS mebleg
      FROM satis_sifarisleri
      WHERE sahibkar_id = ${sahibkarId}::uuid
        AND tarix >= ${start}
        AND status <> 'legv'
        AND COALESCE(qaralama, false) = false
        AND filial_id IS NOT NULL
      GROUP BY filial_id, gun
      ORDER BY filial_id, gun
    `.catch(() => [] as Row[]);

    const trendMap = new Map<number, number[]>();
    for (const r of rows) {
      const arr = trendMap.get(r.filial_id) ?? Array(30).fill(0);
      const idx = Math.floor((new Date(r.gun).getTime() - start.getTime()) / (24 * 3600 * 1000));
      if (idx >= 0 && idx < 30) arr[idx] = Number(r.mebleg ?? 0);
      trendMap.set(r.filial_id, arr);
    }
    return trendMap;
  });
}

/** Counts for the rich hub cards on /sahibkar */
export async function getOwnerHubCounts() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);

    const [
      iscler,
      partiyalar,
      qeydler,
      tapshiriqlarOpen,
      filiallar,
      auditLast24,
      mehsulCount,
      negativeStock,
      noImage,
      noCost,
      dupCustomers,
    ] = await Promise.all([
      prisma.istifadeciler.count({ where: { aktiv: true } }).catch(() => 0),
      prisma.sahibkar_partiya.count().catch(() => 0),
      prisma.sahibkar_qeyd.count().catch(() => 0),
      prisma.sahibkar_tapshiriq.count({
        where: { sahibkar_id: sahibkarId, status: { in: ["acig", "isleyir"] } },
      }).catch(() => 0),
      prisma.filiallar.count({ where: { aktiv: true } }).catch(() => 0),
      prisma.audit_log.count({ where: { yaradildi: { gte: dayAgo } } }).catch(() => 0),
      prisma.mehsullar.count({ where: { aktiv: true } }).catch(() => 0),
      prisma.$queryRaw<{ c: number }[]>`
        SELECT COUNT(*)::int AS c FROM stok WHERE sahibkar_id = ${sahibkarId}::uuid AND miqdar < 0
      `.catch(() => [{ c: 0 }]),
      prisma.mehsullar.count({ where: { OR: [{ sekil_url: null }, { sekil_url: "" }], aktiv: true } }).catch(() => 0),
      prisma.mehsullar.count({ where: { OR: [{ alish_qiymeti: 0 }, { alish_qiymeti: null }], aktiv: true } }).catch(() => 0),
      prisma.$queryRaw<{ c: number }[]>`
        SELECT COUNT(*)::int AS c FROM (
          SELECT telefon FROM kontragentler WHERE sahibkar_id = ${sahibkarId}::uuid AND telefon IS NOT NULL
          GROUP BY telefon HAVING COUNT(*) > 1
        ) d
      `.catch(() => [{ c: 0 }]),
    ]);

    const dataIssues = (negativeStock[0]?.c ?? 0) + noImage + noCost + (dupCustomers[0]?.c ?? 0);

    return {
      isci_count: iscler,
      partiya_count: partiyalar,
      qeyd_count: qeydler,
      open_task_count: tapshiriqlarOpen,
      branch_count: filiallar,
      audit_last24: auditLast24,
      mehsul_count: mehsulCount,
      data_issues: dataIssues,
    };
  });
}

/** Lightweight "critical insights" pulled from existing alerts. */
export async function getOwnerCriticalInsights(limit = 3) {
  return withTenant(async () => {
    const rows = await prisma.alerts.findMany({
      where: {
        status: { in: ["yeni", "baxilir"] },
        seviyye: { in: ["risk", "kritik"] },
      },
      orderBy: [{ seviyye: "desc" }, { first_seen_at: "desc" }],
      take: limit,
      include: { alert_categories: { select: { ad: true, emoji: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      basliq: r.basliq,
      seviyye: r.seviyye,
      kateqoriya_ad: r.alert_categories.ad,
      kateqoriya_emoji: r.alert_categories.emoji,
    }));
  });
}

export async function getOwnerHesabatSummary() {
  return withTenant(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

    const [month, quarter, year, prevYear] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({ where: { tarix: { gte: monthStart }, status: { not: "legv" } }, _sum: { son_mebleg: true }, _count: { _all: true } }),
      prisma.satis_sifarisleri.aggregate({ where: { tarix: { gte: quarterStart }, status: { not: "legv" } }, _sum: { son_mebleg: true }, _count: { _all: true } }),
      prisma.satis_sifarisleri.aggregate({ where: { tarix: { gte: yearStart }, status: { not: "legv" } }, _sum: { son_mebleg: true }, _count: { _all: true } }),
      prisma.satis_sifarisleri.aggregate({ where: { tarix: { gte: prevYearStart, lte: prevYearEnd }, status: { not: "legv" } }, _sum: { son_mebleg: true } }),
    ]);

    const yr = Number(year._sum.son_mebleg ?? 0);
    const pyr = Number(prevYear._sum.son_mebleg ?? 0);

    return {
      month: { revenue: Number(month._sum.son_mebleg ?? 0), orders: month._count._all },
      quarter: { revenue: Number(quarter._sum.son_mebleg ?? 0), orders: quarter._count._all },
      year: { revenue: yr, orders: year._count._all },
      yoy_growth_pct: pyr > 0 ? ((yr - pyr) / pyr) * 100 : 0,
    };
  });
}
