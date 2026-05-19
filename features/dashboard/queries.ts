import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
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

export async function getDashboardKpis(): Promise<DashboardKpis> {
  return withTenant(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [salesAgg, stokAgg, debtAgg, lowStockCount] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: today }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.stok.aggregate({
        _sum: { miqdar: true },
      }),
      prisma.kontragentler.aggregate({
        where: { nov: "musteri", borc: { gt: 0 } },
        _sum: { borc: true },
      }),
      // Low stock: stok.miqdar < mehsul.kritik_stok (raw because Prisma can't
      // compare two columns of the same row directly)
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count
          FROM stok s
          JOIN mehsullar m ON m.id = s.mehsul_id
         WHERE s.sahibkar_id = ${(await getCurrentTenantId())}::uuid
           AND m.kritik_stok IS NOT NULL
           AND m.kritik_stok > 0
           AND COALESCE(s.miqdar, 0) <= m.kritik_stok
      `,
    ]);

    // Gizli mod scale tətbiqi — yalnız display rəqəmlərinə
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      todaySalesAmount: Number(salesAgg._sum.son_mebleg ?? 0) * s,
      todaySalesCount: salesAgg._count._all,
      stockValue: Number(stokAgg._sum.miqdar ?? 0) * s,
      customerDebt: Number(debtAgg._sum.borc ?? 0) * s,
      lowStockCount: Number(lowStockCount[0]?.count ?? 0),
    };
  });
}

export async function getRecentSalesByDay(days = 7): Promise<DailySalesPoint[]> {
  return withTenant(async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    const rows = await prisma.$queryRaw<{ tarix: Date; total: number; cnt: bigint }[]>`
      SELECT tarix,
             COALESCE(SUM(son_mebleg), 0)::float AS total,
             COUNT(*)::bigint AS cnt
        FROM satis_sifarisleri
       WHERE sahibkar_id = ${(await getCurrentTenantId())}::uuid
         AND tarix >= ${from}::date
         AND qaralama IS NOT TRUE
       GROUP BY tarix
       ORDER BY tarix
    `;

    // Fill missing days with zeros
    const byDate = new Map<string, { amount: number; count: number }>();
    for (const r of rows) {
      const iso = r.tarix.toISOString().slice(0, 10);
      byDate.set(iso, { amount: Number(r.total), count: Number(r.cnt) });
    }
    const result: DailySalesPoint[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const v = byDate.get(iso);
      result.push({ date: iso, amount: v?.amount ?? 0, count: v?.count ?? 0 });
    }
    return result;
  });
}

export async function getLowStockItems(limit = 10): Promise<LowStockRow[]> {
  return withTenant(async () => {
    const rows = await prisma.$queryRaw<LowStockRow[]>`
      SELECT m.id          AS mehsul_id,
             m.ad,
             m.kod,
             a.ad          AS anbar_ad,
             COALESCE(s.miqdar, 0)::float AS miqdar,
             m.kritik_stok::float AS kritik_stok
        FROM stok s
        JOIN mehsullar m ON m.id = s.mehsul_id
        JOIN anbarlar a ON a.id = s.anbar_id
       WHERE s.sahibkar_id = ${(await getCurrentTenantId())}::uuid
         AND m.kritik_stok IS NOT NULL
         AND m.kritik_stok > 0
         AND COALESCE(s.miqdar, 0) <= m.kritik_stok
       ORDER BY (m.kritik_stok - COALESCE(s.miqdar, 0)) DESC
       LIMIT ${limit}
    `;
    return rows;
  });
}

// Helper used inside raw queries — gets tenant id from the current context.
// Importing currentTenantId at top would create a circular import; defer.
async function getCurrentTenantId(): Promise<string> {
  const { currentTenantId } = await import("@/lib/db/tenant-context");
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

export async function getCeoKpis(): Promise<CeoKpis> {
  return withTenant(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const sahibkarId = await getCurrentTenantId();

    const [salesToday, monthSalesRow, monthCogsRow, customers, openTasks, lowStockCount] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: today }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: monthStart }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
      }),
      prisma.$queryRaw<{ cogs: number }[]>`
        SELECT COALESCE(SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0)), 0)::float AS cogs
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          JOIN mehsullar m ON m.id = sls.mehsul_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix >= ${monthStart}::date
           AND ss.status != 'legv'
      `.catch(() => [{ cogs: 0 }]),
      prisma.kontragentler.count({ where: { nov: "musteri", aktiv: true } }).catch(() => 0),
      prisma.sahibkar_tapshiriq.count({
        where: { sahibkar_id: sahibkarId, status: { in: ["acig", "isleyir"] } },
      }).catch(() => 0),
      prisma.$queryRaw<{ count: bigint }[]>`
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

    // Gizli mod scale tətbiqi — yalnız display
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      todaySalesAmount: Number(salesToday._sum.son_mebleg ?? 0) * s,
      todaySalesCount: salesToday._count._all ?? 0,
      monthRevenue: monthRev * s,
      netProfitPct: profitPct, // faiz scale-lənmir
      activeCustomers: customers,
      openTasks,
      lowStockCount: Number(lowStockCount[0]?.count ?? 0),
    };
  });
}

export async function getMonthlyComparison(): Promise<MonthlyComparison> {
  return withTenant(async () => {
    const now = new Date();
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const sahibkarId = await getCurrentTenantId();

    const [salesA, salesB, expensesA, expensesB, custA, custB] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: curStart }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: prevStart, lte: prevEnd }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
      }),
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(mebleg), 0)::float AS total FROM "xerclər"
         WHERE sahibkar_id = ${sahibkarId}::uuid AND tarix >= ${curStart}::date
      `.catch(() => [{ total: 0 }]),
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(mebleg), 0)::float AS total FROM "xerclər"
         WHERE sahibkar_id = ${sahibkarId}::uuid AND tarix >= ${prevStart}::date AND tarix <= ${prevEnd}::date
      `.catch(() => [{ total: 0 }]),
      prisma.kontragentler.count({ where: { nov: "musteri", yaradildi: { gte: curStart } } }).catch(() => 0),
      prisma.kontragentler.count({
        where: { nov: "musteri", yaradildi: { gte: prevStart, lte: prevEnd } },
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
  });
}

export async function getTopProducts(limit = 5): Promise<TopProductRow[]> {
  return withTenant(async () => {
    const sahibkarId = await getCurrentTenantId();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const rows = await prisma.$queryRaw<TopProductRow[]>`
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
    return rows;
  });
}

export async function getTopSellers(limit = 5): Promise<TopSellerRow[]> {
  return withTenant(async () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const grouped = await prisma.satis_sifarisleri.groupBy({
      by: ["yaradan_id"],
      where: { tarix: { gte: monthStart }, status: { not: "legv" }, qaralama: { not: true } },
      _sum: { son_mebleg: true },
      _count: { _all: true },
      orderBy: { _sum: { son_mebleg: "desc" } },
      take: limit,
    });
    const ids = grouped.map((g) => g.yaradan_id).filter((x): x is string => !!x);
    if (ids.length === 0) return [];
    const users = await prisma.istifadeciler.findMany({
      where: { id: { in: ids } },
      select: { id: true, ad_soyad: true },
    });
    const map = new Map(users.map((u) => [u.id, u.ad_soyad]));
    return grouped.map((g) => ({
      id: g.yaradan_id ?? "",
      ad_soyad: g.yaradan_id ? map.get(g.yaradan_id) ?? null : null,
      sifaris_say: g._count._all,
      cemi: Number(g._sum.son_mebleg ?? 0),
    }));
  });
}

export type TopCustomerRow = {
  id: string;
  ad: string;
  telefon: string | null;
  sifaris_say: number;
  cemi: number;
};

export async function getTopCustomers(limit = 5): Promise<TopCustomerRow[]> {
  return withTenant(async () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const grouped = await prisma.satis_sifarisleri.groupBy({
      by: ["musteri_id"],
      where: {
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
    const customers = await prisma.kontragentler.findMany({
      where: { id: { in: ids } },
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
  });
}

export type TopPlatformRow = {
  platform: string;
  sifaris_say: number;
  cemi: number;
};

export async function getTopPlatforms(limit = 5): Promise<TopPlatformRow[]> {
  return withTenant(async () => {
    const sahibkarId = await getCurrentTenantId();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const rows = await prisma.$queryRaw<Array<{ platform: string; say: bigint; cemi: number }>>`
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
  });
}

export async function getRecentSales(limit = 5): Promise<RecentSaleRow[]> {
  return withTenant(async () => {
    const rows = await prisma.satis_sifarisleri.findMany({
      where: { qaralama: { not: true } },
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

export async function getRecentActivity(limit = 15): Promise<ActivityEvent[]> {
  return withTenant(async () => {
    const sahibkarId = await getCurrentTenantId();
    const rows = await prisma.audit_log.findMany({
      where: {
        sahibkar_id: sahibkarId,
        // Biznes hadisələri üçün auth/sessiya hadisələrini istisna et
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
  });
}

export async function getCriticalAlertsForDash(limit = 5): Promise<CriticalAlertRow[]> {
  return withTenant(async () => {
    const rows = await prisma.alerts.findMany({
      where: {
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
  });
}

export async function getSalesVsExpense30(): Promise<SalesVsExpensePoint[]> {
  return withTenant(async () => {
    const sahibkarId = await getCurrentTenantId();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - 29);

    const [salesRows, expRows] = await Promise.all([
      prisma.$queryRaw<{ gun: Date; total: number }[]>`
        SELECT tarix AS gun, COALESCE(SUM(son_mebleg), 0)::float AS total
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix >= ${from}::date
           AND status != 'legv'
           AND COALESCE(qaralama, false) = false
         GROUP BY tarix
         ORDER BY tarix
      `,
      prisma.$queryRaw<{ gun: Date; total: number }[]>`
        SELECT tarix AS gun, COALESCE(SUM(mebleg), 0)::float AS total
          FROM "xerclər"
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix >= ${from}::date
         GROUP BY tarix
         ORDER BY tarix
      `.catch(() => [] as { gun: Date; total: number }[]),
    ]);

    const salesMap = new Map<string, number>();
    for (const r of salesRows) salesMap.set(r.gun.toISOString().slice(0, 10), Number(r.total));
    const expMap = new Map<string, number>();
    for (const r of expRows) expMap.set(r.gun.toISOString().slice(0, 10), Number(r.total));

    const result: SalesVsExpensePoint[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      result.push({ gun: iso, satis: salesMap.get(iso) ?? 0, xerc: expMap.get(iso) ?? 0 });
    }
    return result;
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

export async function getTodayCashFlow(): Promise<TodayCashFlow> {
  return withTenant(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sahibkarId = await getCurrentTenantId();

    const rows = await prisma.$queryRaw<{ daxil: number; xaric: number; cnt: number }[]>`
      SELECT
        COALESCE(SUM(CASE WHEN emeliyyat_nov IN ('satis','medaxil') THEN mebleg ELSE 0 END), 0)::float AS daxil,
        COALESCE(SUM(CASE WHEN emeliyyat_nov IN ('qaytarma','mexaric') THEN mebleg ELSE 0 END), 0)::float AS xaric,
        COUNT(*)::int AS cnt
      FROM kassa_emeliyyatlari
      WHERE sahibkar_id = ${sahibkarId}::uuid AND tarix >= ${today}
    `.catch(() => [{ daxil: 0, xaric: 0, cnt: 0 }]);

    const daxil = Number(rows[0]?.daxil ?? 0);
    const xaric = Number(rows[0]?.xaric ?? 0);
    return { daxil, xaric, net: daxil - xaric, emeliyyat_say: Number(rows[0]?.cnt ?? 0) };
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

export async function getMyPendingWork(): Promise<MyPendingWork> {
  return withTenant(async () => {
    const { requireTenant } = await import("@/lib/db/tenant-context");
    const { istifadeciId } = requireTenant();
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const scope = {
      OR: [
        { mesul_id: istifadeciId },
        { tapshiriq_iscilier: { some: { istifadeci_id: istifadeciId } } },
      ],
      status: { notIn: ["tamamlandi", "legv"] },
    };

    const [my_open_tasks, my_today_reminders, my_overdue, next_tasks] = await Promise.all([
      prisma.tapshiriqlar.count({ where: scope }),
      prisma.tapshiriqlar.count({
        where: { ...scope, xatirlatma: { lte: endOfToday, not: null } },
      }),
      prisma.tapshiriqlar.count({
        where: { ...scope, deadline: { lt: now } },
      }),
      prisma.tapshiriqlar.findMany({
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

export async function getDailyInsight(): Promise<DailyInsight> {
  return withTenant(async () => {
    const sahibkarId = await getCurrentTenantId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    try {
      const [today_sales, yesterday_sales, today_cust] = await Promise.all([
        prisma.satis_sifarisleri.aggregate({
          where: { tarix: { gte: today }, status: { not: "legv" }, qaralama: { not: true } },
          _sum: { son_mebleg: true },
          _count: { _all: true },
        }),
        prisma.satis_sifarisleri.aggregate({
          where: { tarix: { gte: yesterday, lt: today }, status: { not: "legv" }, qaralama: { not: true } },
          _sum: { son_mebleg: true },
          _count: { _all: true },
        }),
        prisma.kontragentler.count({
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
  });
}
