import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { currentTenantId, requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export type DashboardKpis = {
  todaySalesAmount: number;
  todaySalesCount: number;
  stockValue: number;
  customerDebt: number;
  lowStockCount: number;
};

export type DailySalesPoint = {
  date: string; // ISO yyyy-mm-dd
  amount: number;
  count: number;
};

export type LowStockRow = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  anbar_ad: string;
  miqdar: number;
  kritik_stok: number;
};

/**
 * Dashboard KPI-ləri 60s cache.
 * Hər navigation-da DB-ni 4 sorğu ilə vurmaq əvəzinə, eyni tenant üçün
 * cache-dən cavab. Stealth scaling cache-dən sonra tətbiq olunur ki,
 * istifadəçi toggle etdikdə dərhal əks olunsun.
 */
async function fetchDashboardKpisRaw(sahibkarId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [salesAgg, stokAgg, debtAgg, lowStockCount] = await Promise.all([
    prismaUnscoped.satis_sifarisleri.aggregate({
      where: { sahibkar_id: sahibkarId, tarix: { gte: today }, qaralama: { not: true } },
      _sum: { son_mebleg: true },
      _count: { _all: true },
    }),
    prismaUnscoped.stok.aggregate({
      where: { sahibkar_id: sahibkarId },
      _sum: { miqdar: true },
    }),
    prismaUnscoped.kontragentler.aggregate({
      // QA-K31: her_ikisi nov-u da müştəridir — vahid mənbə (alacaq SoT)
      where: { sahibkar_id: sahibkarId, nov: { in: ["musteri", "her_ikisi"] }, alacaq: { gt: 0 } },
      _sum: { alacaq: true },
    }),
    prismaUnscoped.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
        FROM stok s
        JOIN mehsullar m ON m.id = s.mehsul_id
       WHERE s.sahibkar_id = ${sahibkarId}::uuid
         AND m.kritik_stok IS NOT NULL
         AND m.kritik_stok > 0
         AND COALESCE(s.miqdar, 0) <= m.kritik_stok
    `,
  ]);

  return {
    todaySalesAmount: Number(salesAgg._sum.son_mebleg ?? 0),
    todaySalesCount: salesAgg._count._all,
    stockValue: Number(stokAgg._sum.miqdar ?? 0),
    customerDebt: Number(debtAgg._sum.alacaq ?? 0),
    lowStockCount: Number(lowStockCount[0]?.count ?? 0),
  };
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchDashboardKpisRaw(sahibkarId),
      ["dashboard-kpis", sahibkarId],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    const raw = await cached();
    // Stealth scale cache-dən sonra — toggle dərhal əks olunsun
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return {
      ...raw,
      todaySalesAmount: raw.todaySalesAmount * s,
      stockValue: raw.stockValue * s,
      customerDebt: raw.customerDebt * s,
    };
  });
}

async function fetchRecentSalesByDayRaw(sahibkarId: string, days: number) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));

  const rows = await prismaUnscoped.$queryRaw<{ tarix: Date; total: number; cnt: bigint }[]>`
    SELECT tarix,
           COALESCE(SUM(son_mebleg), 0)::float AS total,
           COUNT(*)::bigint AS cnt
      FROM satis_sifarisleri
     WHERE sahibkar_id = ${sahibkarId}::uuid
       AND tarix >= ${from}::date
       AND qaralama IS NOT TRUE
       AND status <> 'legv' -- (audit #17) ləğv satış 30-günlük trendə düşməsin (SalesVsExpense ilə uyğun)
     GROUP BY tarix
     ORDER BY tarix
  `;
  return { from, rows };
}

export async function getRecentSalesByDay(days = 7): Promise<DailySalesPoint[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchRecentSalesByDayRaw(sahibkarId, days),
      ["dashboard-sales-by-day", sahibkarId, String(days)],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    const { from, rows } = await cached();

    // Fill missing days with zeros — `unstable_cache` JSON serializasiya edir
    // ona görə Date sahələri string kimi qayıda bilər
    const byDate = new Map<string, { amount: number; count: number }>();
    for (const r of rows) {
      const iso = new Date(r.tarix).toISOString().slice(0, 10);
      byDate.set(iso, { amount: Number(r.total), count: Number(r.cnt) });
    }
    const fromDate = new Date(from);
    const result: DailySalesPoint[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(fromDate);
      d.setDate(fromDate.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const v = byDate.get(iso);
      result.push({ date: iso, amount: v?.amount ?? 0, count: v?.count ?? 0 });
    }
    return result;
  });
}

async function fetchLowStockItemsRaw(sahibkarId: string, limit: number): Promise<LowStockRow[]> {
  return prismaUnscoped.$queryRaw<LowStockRow[]>`
    SELECT m.id          AS mehsul_id,
           m.ad,
           m.kod,
           a.ad          AS anbar_ad,
           COALESCE(s.miqdar, 0)::float AS miqdar,
           m.kritik_stok::float AS kritik_stok
      FROM stok s
      JOIN mehsullar m ON m.id = s.mehsul_id
      JOIN anbarlar a ON a.id = s.anbar_id
     WHERE s.sahibkar_id = ${sahibkarId}::uuid
       AND m.kritik_stok IS NOT NULL
       AND m.kritik_stok > 0
       AND COALESCE(s.miqdar, 0) <= m.kritik_stok
     ORDER BY (m.kritik_stok - COALESCE(s.miqdar, 0)) DESC
     LIMIT ${limit}
  `;
}

export async function getLowStockItems(limit = 10): Promise<LowStockRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchLowStockItemsRaw(sahibkarId, limit),
      ["dashboard-low-stock", sahibkarId, String(limit)],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`, `stok:${sahibkarId}`] },
    );
    return cached();
  });
}

// Helper used inside raw queries — sinxron tenant id oxuyur.
// (Promise wrap-i tələbsizdir; bütün çağırıçlar withTenant() içindədir.)
function getCurrentTenantId(): string {
  const id = currentTenantId();
  if (!id) throw new Error("No tenant in context");
  return id;
}

export type CeoKpis = {
  todaySalesAmount: number;
  todaySalesCount: number;
  monthRevenue: number;
  netProfitPct: number;
  activeCustomers: number;
  openTasks: number;
  lowStockCount: number;
};

export type MonthlyComparison = {
  current: { revenue: number; expense: number; profit: number; newCustomers: number };
  previous: { revenue: number; expense: number; profit: number; newCustomers: number };
};

export type TopProductRow = { ad: string; miqdar: number; mebleg: number };

export type TopSellerRow = {
  id: string;
  ad_soyad: string | null;
  sifaris_say: number;
  cemi: number;
};

export type RecentSaleRow = {
  id: string;
  nomre: string;
  tarix: Date;
  status: string | null;
  son_mebleg: number;
  musteri_ad: string | null;
};

export type ActivityEvent = {
  id: string;
  tarix: Date;
  tip: "satis" | "kassa" | "audit" | "xeberdar" | "servis";
  basliq: string;
  detail: string | null;
};

export type CriticalAlertRow = {
  id: string;
  basliq: string;
  seviyye: string;
  kateqoriya_ad: string;
};

export type SalesVsExpensePoint = { gun: string; satis: number; xerc: number };

async function fetchCeoKpisRaw(sahibkarId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [salesToday, monthSalesRow, monthCogsRow, customers, openTasks, lowStockCount] = await Promise.all([
    prismaUnscoped.satis_sifarisleri.aggregate({
      where: { sahibkar_id: sahibkarId, tarix: { gte: today }, status: { not: "legv" }, qaralama: { not: true } },
      _sum: { son_mebleg: true },
      _count: { _all: true },
    }),
    prismaUnscoped.satis_sifarisleri.aggregate({
      where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, status: { not: "legv" }, qaralama: { not: true } },
      _sum: { son_mebleg: true },
    }),
    prismaUnscoped.$queryRaw<{ cogs: number }[]>`
      SELECT COALESCE(SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)), 0)::float AS cogs
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix >= ${monthStart}::date
         AND ss.status != 'legv'
    `.catch(() => [{ cogs: 0 }]),
    prismaUnscoped.kontragentler.count({ where: { sahibkar_id: sahibkarId, nov: "musteri", aktiv: true } }).catch(() => 0),
    prismaUnscoped.sahibkar_tapshiriq.count({
      where: { sahibkar_id: sahibkarId, status: { in: ["acig", "isleyir"] } },
    }).catch(() => 0),
    prismaUnscoped.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
        FROM stok s
        JOIN mehsullar m ON m.id = s.mehsul_id
       WHERE s.sahibkar_id = ${sahibkarId}::uuid
         AND m.kritik_stok IS NOT NULL
         AND m.kritik_stok > 0
         AND COALESCE(s.miqdar, 0) <= m.kritik_stok
    `,
  ]);

  const monthRev = Number(monthSalesRow._sum.son_mebleg ?? 0);
  const cogs = Number(monthCogsRow[0]?.cogs ?? 0);
  const profit = monthRev - cogs;
  const profitPct = monthRev > 0 ? (profit / monthRev) * 100 : 0;

  return {
    todaySalesAmount: Number(salesToday._sum.son_mebleg ?? 0),
    todaySalesCount: salesToday._count._all ?? 0,
    monthRevenue: monthRev,
    netProfitPct: profitPct,
    activeCustomers: customers,
    openTasks,
    lowStockCount: Number(lowStockCount[0]?.count ?? 0),
  };
}

export async function getCeoKpis(): Promise<CeoKpis> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchCeoKpisRaw(sahibkarId),
      ["dashboard-ceo-kpis", sahibkarId],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    const raw = await cached();
    // Stealth scale cache-dən sonra — toggle dərhal əks olunsun
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return {
      ...raw,
      todaySalesAmount: raw.todaySalesAmount * s,
      monthRevenue: raw.monthRevenue * s,
    };
  });
}

async function fetchMonthlyComparisonRaw(sahibkarId: string): Promise<MonthlyComparison> {
  const now = new Date();
  const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [salesA, salesB, expensesA, expensesB, custA, custB] = await Promise.all([
    prismaUnscoped.satis_sifarisleri.aggregate({
      where: { sahibkar_id: sahibkarId, tarix: { gte: curStart }, status: { not: "legv" }, qaralama: { not: true } },
      _sum: { son_mebleg: true },
    }),
    prismaUnscoped.satis_sifarisleri.aggregate({
      where: { sahibkar_id: sahibkarId, tarix: { gte: prevStart, lte: prevEnd }, status: { not: "legv" }, qaralama: { not: true } },
      _sum: { son_mebleg: true },
    }),
    prismaUnscoped.$queryRaw<{ total: number }[]>`
      -- QA-orta: P&L hesabatları ilə eyni AZN-normalize sahə (mebleg_azn)
      SELECT COALESCE(SUM(mebleg_azn), 0)::float AS total FROM "xerclər"
       WHERE sahibkar_id = ${sahibkarId}::uuid AND tarix >= ${curStart}::date AND legv_de IS NULL
    `.catch(() => [{ total: 0 }]),
    prismaUnscoped.$queryRaw<{ total: number }[]>`
      -- QA-orta: P&L hesabatları ilə eyni AZN-normalize sahə (mebleg_azn)
      SELECT COALESCE(SUM(mebleg_azn), 0)::float AS total FROM "xerclər"
       WHERE sahibkar_id = ${sahibkarId}::uuid AND tarix >= ${prevStart}::date AND tarix <= ${prevEnd}::date AND legv_de IS NULL
    `.catch(() => [{ total: 0 }]),
    prismaUnscoped.kontragentler.count({ where: { sahibkar_id: sahibkarId, nov: "musteri", yaradildi: { gte: curStart } } }).catch(() => 0),
    prismaUnscoped.kontragentler.count({
      where: { sahibkar_id: sahibkarId, nov: "musteri", yaradildi: { gte: prevStart, lte: prevEnd } },
    }).catch(() => 0),
  ]);

  const curRev = Number(salesA._sum.son_mebleg ?? 0);
  const prevRev = Number(salesB._sum.son_mebleg ?? 0);
  const curExp = Number(expensesA[0]?.total ?? 0);
  const prevExp = Number(expensesB[0]?.total ?? 0);

  return {
    current: { revenue: curRev, expense: curExp, profit: curRev - curExp, newCustomers: custA },
    previous: { revenue: prevRev, expense: prevExp, profit: prevRev - prevExp, newCustomers: custB },
  };
}

export async function getMonthlyComparison(): Promise<MonthlyComparison> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchMonthlyComparisonRaw(sahibkarId),
      ["dashboard-monthly-comparison", sahibkarId],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    return cached();
  });
}

async function fetchTopProductsRaw(sahibkarId: string, limit: number): Promise<TopProductRow[]> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  return prismaUnscoped.$queryRaw<TopProductRow[]>`
    SELECT m.ad,
           COALESCE(SUM(sls.miqdar), 0)::float AS miqdar,
           COALESCE(SUM(sls.cemi), 0)::float AS mebleg
      FROM satis_sifaris_satirlari sls
      JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
      JOIN mehsullar m ON m.id = sls.mehsul_id
     WHERE sls.sahibkar_id = ${sahibkarId}::uuid
       AND ss.tarix >= ${monthStart}::date
       AND ss.status != 'legv'
       AND COALESCE(ss.qaralama, false) = false
     GROUP BY m.ad
     ORDER BY mebleg DESC
     LIMIT ${limit}
  `;
}

export async function getTopProducts(limit = 5): Promise<TopProductRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchTopProductsRaw(sahibkarId, limit),
      ["dashboard-top-products", sahibkarId, String(limit)],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    return cached();
  });
}

async function fetchTopSellersRaw(sahibkarId: string, limit: number): Promise<TopSellerRow[]> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const grouped = await prismaUnscoped.satis_sifarisleri.groupBy({
    by: ["yaradan_id"],
    where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, status: { not: "legv" }, qaralama: { not: true } },
    _sum: { son_mebleg: true },
    _count: { _all: true },
    orderBy: { _sum: { son_mebleg: "desc" } },
    take: limit,
  });
  const ids = grouped.map((g) => g.yaradan_id).filter((x): x is string => !!x);
  if (ids.length === 0) return [];
  const users = await prismaUnscoped.istifadeciler.findMany({
    where: { id: { in: ids }, sahibkar_id: sahibkarId },
    select: { id: true, ad_soyad: true },
  });
  const map = new Map(users.map((u) => [u.id, u.ad_soyad]));
  return grouped.map((g) => ({
    id: g.yaradan_id ?? "",
    ad_soyad: g.yaradan_id ? map.get(g.yaradan_id) ?? null : null,
    sifaris_say: g._count._all,
    cemi: Number(g._sum.son_mebleg ?? 0),
  }));
}

export async function getTopSellers(limit = 5): Promise<TopSellerRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchTopSellersRaw(sahibkarId, limit),
      ["dashboard-top-sellers", sahibkarId, String(limit)],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    return cached();
  });
}

export type TopCustomerRow = {
  id: string;
  ad: string;
  telefon: string | null;
  sifaris_say: number;
  cemi: number;
};

async function fetchTopCustomersRaw(sahibkarId: string, limit: number): Promise<TopCustomerRow[]> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const grouped = await prismaUnscoped.satis_sifarisleri.groupBy({
    by: ["musteri_id"],
    where: {
      sahibkar_id: sahibkarId,
      musteri_id: { not: null },
      tarix: { gte: monthStart },
      status: { not: "legv" },
      qaralama: { not: true },
    },
    _sum: { son_mebleg: true },
    _count: { _all: true },
    orderBy: { _sum: { son_mebleg: "desc" } },
    take: limit,
  });
  const ids = grouped.map((g) => g.musteri_id).filter((x): x is string => !!x);
  if (ids.length === 0) return [];
  const customers = await prismaUnscoped.kontragentler.findMany({
    where: { id: { in: ids }, sahibkar_id: sahibkarId },
    select: { id: true, ad: true, telefon: true },
  });
  const map = new Map(customers.map((c) => [c.id, c]));
  return grouped.flatMap((g) => {
    if (!g.musteri_id) return [];
    const c = map.get(g.musteri_id);
    if (!c) return [];
    return [{
      id: c.id,
      ad: c.ad,
      telefon: c.telefon,
      sifaris_say: g._count._all,
      cemi: Number(g._sum.son_mebleg ?? 0),
    }];
  });
}

export async function getTopCustomers(limit = 5): Promise<TopCustomerRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchTopCustomersRaw(sahibkarId, limit),
      ["dashboard-top-customers", sahibkarId, String(limit)],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    return cached();
  });
}

export type TopPlatformRow = {
  platform: string;
  sifaris_say: number;
  cemi: number;
};

async function fetchTopPlatformsRaw(sahibkarId: string, limit: number): Promise<TopPlatformRow[]> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const rows = await prismaUnscoped.$queryRaw<Array<{ platform: string; say: bigint; cemi: number }>>`
    SELECT COALESCE(NULLIF(s.marketplace_platform, ''), 'Birbaşa satış') AS platform,
           COUNT(*)::bigint AS say,
           COALESCE(SUM(s.son_mebleg), 0)::float AS cemi
    FROM satis_sifarisleri s
    WHERE s.sahibkar_id = ${sahibkarId}::uuid
      AND s.tarix >= ${monthStart}::date
      AND COALESCE(s.status, '') NOT IN ('legv')
      AND COALESCE(s.qaralama, false) = false
    GROUP BY platform
    ORDER BY cemi DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    platform: r.platform,
    sifaris_say: Number(r.say),
    cemi: Number(r.cemi),
  }));
}

export async function getTopPlatforms(limit = 5): Promise<TopPlatformRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchTopPlatformsRaw(sahibkarId, limit),
      ["dashboard-top-platforms", sahibkarId, String(limit)],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    return cached();
  });
}

async function fetchRecentSalesRaw(sahibkarId: string, limit: number): Promise<RecentSaleRow[]> {
  const rows = await prismaUnscoped.satis_sifarisleri.findMany({
    where: { sahibkar_id: sahibkarId, qaralama: { not: true } },
    orderBy: { yaradildi: "desc" },
    take: limit,
    select: {
      id: true,
      nomre: true,
      tarix: true,
      status: true,
      son_mebleg: true,
      kontragentler: { select: { ad: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    nomre: r.nomre,
    tarix: r.tarix,
    status: r.status,
    son_mebleg: Number(r.son_mebleg ?? 0),
    musteri_ad: r.kontragentler?.ad ?? null,
  }));
}

export async function getRecentSales(limit = 5): Promise<RecentSaleRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchRecentSalesRaw(sahibkarId, limit),
      ["dashboard-recent-sales", sahibkarId, String(limit)],
      { revalidate: 30, tags: [`dashboard:${sahibkarId}`, `sales:${sahibkarId}`] },
    );
    return cached();
  });
}

const ACTION_LABEL: Record<string, string> = {
  YARADILDI: "yaratdı",
  YENILENDI: "yenilədi",
  SILINDI: "sildi",
  TESDIQ: "təsdiqlədi",
  LEGV: "ləğv etdi",
  ODENIS: "ödəniş etdi",
  QAYTARMA: "qaytardı",
};

const RESOURCE_LABEL: Record<string, string> = {
  satis: "satış",
  satis_sifarisi: "satış",
  alis: "alış",
  alis_sifarisi: "alış",
  teklif: "təklif",
  qaytarma: "qaytarma",
  kassa: "kassa əməliyyatı",
  kassa_emeliyyati: "kassa əməliyyatı",
  mehsul: "məhsul",
  kontragent: "müştəri/təchizatçı",
  musteri: "müştəri",
  servis: "servis",
  servis_qeydi: "servis qeydi",
  xeberdarliq: "xəbərdarlıq",
  alert: "xəbərdarlıq",
  kredit: "kredit satış",
  tapshiriq: "tapşırıq",
  anbar_hereketi: "stok hərəkəti",
};

async function fetchRecentActivityRaw(sahibkarId: string, limit: number): Promise<ActivityEvent[]> {
  const rows = await prismaUnscoped.audit_log.findMany({
    where: {
      sahibkar_id: sahibkarId,
      resurs_nov: { notIn: ["istifadeci", "session", "auth"] },
      emeliyyat: { notIn: ["GIRIS", "CIXIS", "LOGIN", "LOGOUT", "OXUDU", "READ", "BAXDI"] },
    },
    orderBy: { yaradildi: "desc" },
    take: limit,
    select: {
      id: true,
      yaradildi: true,
      emeliyyat: true,
      resurs_nov: true,
      resurs_id: true,
      istifadeci_ad: true,
    },
  });
  return rows.map((r) => {
    const tip: ActivityEvent["tip"] = r.resurs_nov?.startsWith("satis")
      ? "satis"
      : r.resurs_nov === "kassa" || r.resurs_nov === "kassa_emeliyyati"
      ? "kassa"
      : r.resurs_nov === "alert" || r.resurs_nov === "xeberdarliq"
      ? "xeberdar"
      : r.resurs_nov === "servis" || r.resurs_nov === "servis_qeydi"
      ? "servis"
      : "audit";
    const actionLabel = ACTION_LABEL[r.emeliyyat?.toUpperCase() ?? ""] ?? r.emeliyyat?.toLowerCase() ?? "—";
    const resourceLabel = RESOURCE_LABEL[r.resurs_nov ?? ""] ?? r.resurs_nov ?? "";
    const who = r.istifadeci_ad ?? "Sistem";
    return {
      id: r.id.toString(),
      tarix: r.yaradildi ?? new Date(),
      tip,
      basliq: `${who} bir ${resourceLabel} ${actionLabel}`,
      detail: null,
    };
  });
}

export async function getRecentActivity(limit = 15): Promise<ActivityEvent[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchRecentActivityRaw(sahibkarId, limit),
      ["dashboard-recent-activity", sahibkarId, String(limit)],
      { revalidate: 30, tags: [`dashboard:${sahibkarId}`, `audit:${sahibkarId}`] },
    );
    return cached();
  });
}

async function fetchCriticalAlertsForDashRaw(sahibkarId: string, limit: number): Promise<CriticalAlertRow[]> {
  const rows = await prismaUnscoped.alerts.findMany({
    where: {
      sahibkar_id: sahibkarId,
      status: { in: ["yeni", "baxilir"] },
      seviyye: { in: ["risk", "kritik"] },
    },
    orderBy: [{ seviyye: "desc" }, { first_seen_at: "desc" }],
    take: limit,
    include: { alert_categories: { select: { ad: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
      basliq: r.basliq,
      seviyye: r.seviyye,
      kateqoriya_ad: r.alert_categories.ad,
  }));
}

export async function getCriticalAlertsForDash(limit = 5): Promise<CriticalAlertRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchCriticalAlertsForDashRaw(sahibkarId, limit),
      ["dashboard-critical-alerts", sahibkarId, String(limit)],
      { revalidate: 30, tags: [`dashboard:${sahibkarId}`, `alerts:${sahibkarId}`] },
    );
    return cached();
  });
}

async function fetchSalesVsExpense30Raw(sahibkarId: string): Promise<SalesVsExpensePoint[]> {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 29);

  const [salesRows, expRows] = await Promise.all([
    prismaUnscoped.$queryRaw<{ gun: Date; total: number }[]>`
      SELECT tarix AS gun, COALESCE(SUM(son_mebleg), 0)::float AS total
        FROM satis_sifarisleri
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix >= ${from}::date
         AND status != 'legv'
         AND COALESCE(qaralama, false) = false
       GROUP BY tarix
       ORDER BY tarix
    `,
    prismaUnscoped.$queryRaw<{ gun: Date; total: number }[]>`
      -- QA-orta: P&L hesabatları ilə eyni AZN-normalize sahə (mebleg_azn)
      SELECT tarix AS gun, COALESCE(SUM(mebleg_azn), 0)::float AS total
        FROM "xerclər"
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix >= ${from}::date
         AND legv_de IS NULL -- (audit #9) ləğv xərc daxil olmasın
       GROUP BY tarix
       ORDER BY tarix
    `.catch(() => [] as { gun: Date; total: number }[]),
  ]);

  const salesMap = new Map<string, number>();
  for (const r of salesRows) salesMap.set(new Date(r.gun).toISOString().slice(0, 10), Number(r.total));
  const expMap = new Map<string, number>();
  for (const r of expRows) expMap.set(new Date(r.gun).toISOString().slice(0, 10), Number(r.total));

  const result: SalesVsExpensePoint[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    result.push({ gun: iso, satis: salesMap.get(iso) ?? 0, xerc: expMap.get(iso) ?? 0 });
  }
  return result;
}

export async function getSalesVsExpense30(): Promise<SalesVsExpensePoint[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchSalesVsExpense30Raw(sahibkarId),
      ["dashboard-sales-vs-expense", sahibkarId],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    return cached();
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Today's cash flow — quick widget for the dashboard
 * ────────────────────────────────────────────────────────────────────────── */

export type TodayCashFlow = {
  daxil: number;
  xaric: number;
  net: number;
  emeliyyat_say: number;
};

async function fetchTodayCashFlowRaw(sahibkarId: string): Promise<TodayCashFlow> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await prismaUnscoped.$queryRaw<{ daxil: number; xaric: number; cnt: number }[]>`
    SELECT
      COALESCE(SUM(CASE WHEN emeliyyat_nov IN ('satis','medaxil') THEN mebleg ELSE 0 END), 0)::float AS daxil,
      COALESCE(SUM(CASE WHEN emeliyyat_nov IN ('qaytarma','mexaric') THEN ABS(mebleg) ELSE 0 END), 0)::float AS xaric,
      COUNT(*)::int AS cnt
    FROM kassa_emeliyyatlari
    WHERE sahibkar_id = ${sahibkarId}::uuid AND tarix >= ${today}
  `.catch(() => [{ daxil: 0, xaric: 0, cnt: 0 }]);

  const daxil = Number(rows[0]?.daxil ?? 0);
  const xaric = Number(rows[0]?.xaric ?? 0);
  return { daxil, xaric, net: daxil - xaric, emeliyyat_say: Number(rows[0]?.cnt ?? 0) };
}

export async function getTodayCashFlow(): Promise<TodayCashFlow> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchTodayCashFlowRaw(sahibkarId),
      ["dashboard-today-cashflow", sahibkarId],
      { revalidate: 30, tags: [`dashboard:${sahibkarId}`, `kassa:${sahibkarId}`] },
    );
    return cached();
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * My pending work — tasks assigned to current user
 * ────────────────────────────────────────────────────────────────────────── */

export type MyPendingWork = {
  my_open_tasks: number;
  my_today_reminders: number;
  my_overdue: number;
  next_tasks: { id: string; basliq: string; deadline: Date | null; prioritet: string | null; status: string | null }[];
};

async function fetchMyPendingWorkRaw(sahibkarId: string, istifadeciId: string): Promise<MyPendingWork> {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const scope = {
    sahibkar_id: sahibkarId,
    OR: [
      { mesul_id: istifadeciId },
      { tapshiriq_iscilier: { some: { istifadeci_id: istifadeciId } } },
    ],
    status: { notIn: ["tamamlandi", "legv"] },
  };

  const [my_open_tasks, my_today_reminders, my_overdue, next_tasks] = await Promise.all([
    prismaUnscoped.tapshiriqlar.count({ where: scope }),
    prismaUnscoped.tapshiriqlar.count({
      where: { ...scope, xatirlatma: { lte: endOfToday, not: null } },
    }),
    prismaUnscoped.tapshiriqlar.count({
      where: { ...scope, deadline: { lt: now } },
    }),
    prismaUnscoped.tapshiriqlar.findMany({
      where: scope,
      orderBy: [
        { prioritet: "desc" },
        { deadline: { sort: "asc", nulls: "last" } },
      ],
      take: 5,
      select: { id: true, basliq: true, deadline: true, prioritet: true, status: true },
    }),
  ]);

  return { my_open_tasks, my_today_reminders, my_overdue, next_tasks };
}

export async function getMyPendingWork(): Promise<MyPendingWork> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const cached = unstable_cache(
      () => fetchMyPendingWorkRaw(sahibkarId, istifadeciId),
      ["dashboard-my-pending-work", sahibkarId, istifadeciId],
      { revalidate: 30, tags: [`dashboard:${sahibkarId}`, `mywork:${sahibkarId}:${istifadeciId}`] },
    );
    return cached();
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Smart daily insight — one-line dynamic message
 * ────────────────────────────────────────────────────────────────────────── */

export type DailyInsight = {
  emoji: string;
  text: string;
  tone: "success" | "warning" | "danger" | "info";
};

async function fetchDailyInsightRaw(sahibkarId: string): Promise<DailyInsight> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  try {
    const [today_sales, yesterday_sales, today_cust] = await Promise.all([
      prismaUnscoped.satis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: today }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prismaUnscoped.satis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: yesterday, lt: today }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prismaUnscoped.kontragentler.count({
        where: { sahibkar_id: sahibkarId, yaradildi: { gte: today }, nov: { in: ["musteri", "her_ikisi"] } },
      }),
    ]);

    const todayTotal = Number(today_sales._sum.son_mebleg ?? 0);
    const yesterdayTotal = Number(yesterday_sales._sum.son_mebleg ?? 0);
    const cnt = today_sales._count._all;

    if (cnt === 0) {
      return { emoji: "🌅", text: "Bu gün hələ heç bir satış yoxdur — başlayaq?", tone: "info" };
    }
    if (yesterdayTotal > 0 && todayTotal > yesterdayTotal * 1.2) {
      return { emoji: "🚀", text: `Bu gün ${cnt} satış, dünəndən ${(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100).toFixed(0)}% daha yaxşı!`, tone: "success" };
    }
    if (yesterdayTotal > 0 && todayTotal < yesterdayTotal * 0.7) {
      return { emoji: "⚠️", text: `Bu gün ${cnt} satış — dünəndən ${(((yesterdayTotal - todayTotal) / yesterdayTotal) * 100).toFixed(0)}% azdır`, tone: "warning" };
    }
    if (today_cust > 0) {
      return { emoji: "👋", text: `Bu gün ${today_cust} yeni müştəri qoşuldu, ${cnt} satış edildi`, tone: "success" };
    }
    return { emoji: "📊", text: `Bu gün ${cnt} satış işlənib. Trend stabil.`, tone: "info" };
  } catch {
    return { emoji: "✨", text: "Yeni iş gününüz xeyirli olsun", tone: "info" };
  }
}

export async function getDailyInsight(): Promise<DailyInsight> {
  return withTenant(async () => {
    const sahibkarId = getCurrentTenantId();
    const cached = unstable_cache(
      () => fetchDailyInsightRaw(sahibkarId),
      ["dashboard-daily-insight", sahibkarId],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    return cached();
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Top borclu müştərilər — top debtors (dashboard + mobil üçün paylaşılan)
 * ────────────────────────────────────────────────────────────────────────── */

export type TopDebtorRow = {
  id: string;
  ad: string;
  telefon: string | null;
  borc: number;
  gecikme_gun: number;
  acig_say: number;
};

async function fetchTopDebtorsRaw(sahibkarId: string, limit: number): Promise<TopDebtorRow[]> {
  const rows = await prismaUnscoped.$queryRaw<TopDebtorRow[]>`
    SELECT k.id,
           k.ad,
           k.telefon,
           COALESCE(SUM(s.son_mebleg - COALESCE(s.odenilmis, 0)), 0)::float AS borc,
           COALESCE(MAX((CURRENT_DATE - s.tarix)), 0)::int AS gecikme_gun,
           COUNT(*)::int AS acig_say
      FROM kontragentler k
      JOIN satis_sifarisleri s ON s.musteri_id = k.id
     WHERE k.sahibkar_id = ${sahibkarId}::uuid
       AND s.sahibkar_id = ${sahibkarId}::uuid
       -- (audit #11) tam qaytarılmış/soft-silinmiş satış borc kimi sayılmamalı
       AND s.status NOT IN ('legv','qaytarilib')
       AND s.deleted_at IS NULL
       AND COALESCE(s.qaralama, false) = false
       AND s.odenis_nov IN ('nisye', 'borc')
       AND s.son_mebleg - COALESCE(s.odenilmis, 0) > 0
     GROUP BY k.id, k.ad, k.telefon
     ORDER BY borc DESC
     LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    ad: r.ad,
    telefon: r.telefon,
    borc: Number(r.borc),
    gecikme_gun: Number(r.gecikme_gun),
    acig_say: Number(r.acig_say),
  }));
}

export async function getTopDebtors(limit = 5): Promise<TopDebtorRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchTopDebtorsRaw(sahibkarId, limit),
      ["dashboard-top-debtors", sahibkarId, String(limit)],
      { revalidate: 60, tags: [`dashboard:${sahibkarId}`] },
    );
    return cached();
  });
}
