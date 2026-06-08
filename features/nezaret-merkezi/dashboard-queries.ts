import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type RiskDashboardData = {
  // Alerts
  alert_open: number;
  alert_kritik: number;
  alert_today: number;
  alert_resolved_today: number;
  // Approvals
  tesdiq_gozleyen: number;
  tesdiq_kritik: number;
  tesdiq_today_completed: number;
  // Tasks
  task_overdue: number;
  // Stock risk
  stock_zero: number;
  stock_low: number;
  // Debt risk
  debtor_count: number;
  debtor_amount: number;
  overdue_debt: number;
  // Workforce
  late_employees_today: number;
  // Service
  service_stalled: number;
  // Marketplace
  mp_pending: number;
  // Top risky processes — group by alert category
  top_categories: { kateqoriya_kod: string; kateqoriya_ad: string; count: number; emoji: string | null }[];
  // Most repeated problems — group by rule_kod
  recurring: { rule_kod: string | null; count: number; example: string }[];
  // Last 24h: alerts created
  alerts_24h: number;
  // Active automation rules
  active_rules: number;
  // 24h automation triggers
  automation_runs_24h: number;
  automation_errors_24h: number;
};

const fetchRiskDashboardCached = (sahibkarId: string) =>
  unstable_cache(
    async (): Promise<RiskDashboardData> => {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const day = new Date(now.getTime() - 24 * 3600 * 1000);

      const [
        alert_open, alert_kritik, alert_today, alert_resolved_today,
        tesdiq_gozleyen, tesdiq_kritik, tesdiq_today_completed,
        task_overdue,
        stock_zero, stock_low,
        debtors,
        late_today,
        service_stalled,
        mp_pending,
        top_cats_raw,
        recurring_raw,
        alerts_24h,
        active_rules,
        automation_runs_24h, automation_errors_24h,
      ] = await Promise.all([
        prismaUnscoped.alerts.count({ where: { sahibkar_id: sahibkarId, status: { in: ["yeni", "baxilir"] } } }),
        prismaUnscoped.alerts.count({ where: { sahibkar_id: sahibkarId, status: { in: ["yeni", "baxilir"] }, seviyye: "kritik" } }),
        prismaUnscoped.alerts.count({ where: { sahibkar_id: sahibkarId, first_seen_at: { gte: todayStart } } }),
        prismaUnscoped.alerts.count({ where: { sahibkar_id: sahibkarId, status: "hell_olundu", resolved_at: { gte: todayStart } } }),

        prismaUnscoped.tesdiq_telep.count({ where: { sahibkar_id: sahibkarId, status: "gozleyir" } }),
        prismaUnscoped.tesdiq_telep.count({ where: { sahibkar_id: sahibkarId, status: "gozleyir", prioritet: { in: ["yuxsek", "kritik"] } } }),
        prismaUnscoped.tesdiq_telep.count({ where: { sahibkar_id: sahibkarId, status: { in: ["tesdiq", "red"] }, netice_tarix: { gte: todayStart } } }),

        prismaUnscoped.tapshiriqlar.count({ where: { sahibkar_id: sahibkarId, deadline: { lt: now }, status: { notIn: ["tamamlandi", "legv"] } } }),

        prismaUnscoped.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(DISTINCT m.id)::bigint AS c
            FROM mehsullar m WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
              AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) = 0
        `.catch(() => [{ c: 0n }]).then((r) => Number(r[0]?.c ?? 0)),
        prismaUnscoped.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(DISTINCT m.id)::bigint AS c
            FROM mehsullar m WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
              AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) BETWEEN 1 AND 5
        `.catch(() => [{ c: 0n }]).then((r) => Number(r[0]?.c ?? 0)),

        prismaUnscoped.kontragentler.aggregate({
          where: { sahibkar_id: sahibkarId, aktiv: true, alacaq: { gt: 0 } },
          _count: { _all: true },
          _sum: { alacaq: true },
        }),

        prismaUnscoped.alerts.count({
          where: {
            sahibkar_id: sahibkarId,
            kateqoriya_kod: { in: ["isci_gec", "isci_devamiyyet"] },
            first_seen_at: { gte: todayStart },
          },
        }).catch(() => 0),

        prismaUnscoped.alerts.count({
          where: {
            sahibkar_id: sahibkarId,
            kateqoriya_kod: { in: ["servis_gecikme", "servis"] },
            status: { in: ["yeni", "baxilir"] },
          },
        }).catch(() => 0),

        prismaUnscoped.alerts.count({
          where: {
            sahibkar_id: sahibkarId,
            kateqoriya_kod: { in: ["marketplace", "mp_gecikme"] },
            status: { in: ["yeni", "baxilir"] },
          },
        }).catch(() => 0),

        prismaUnscoped.alerts.groupBy({
          by: ["kateqoriya_kod"],
          where: { sahibkar_id: sahibkarId, status: { in: ["yeni", "baxilir"] } },
          _count: { _all: true },
          orderBy: { _count: { kateqoriya_kod: "desc" } },
          take: 6,
        }),

        prismaUnscoped.alerts.groupBy({
          by: ["rule_kod"],
          where: { sahibkar_id: sahibkarId, rule_kod: { not: null }, first_seen_at: { gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) } },
          _count: { _all: true },
          orderBy: { _count: { rule_kod: "desc" } },
          take: 5,
        }),

        prismaUnscoped.alerts.count({ where: { sahibkar_id: sahibkarId, first_seen_at: { gte: day } } }),

        prismaUnscoped.avto_qayda.count({ where: { sahibkar_id: sahibkarId, aktiv: true } }),
        prismaUnscoped.avto_log.count({ where: { sahibkar_id: sahibkarId, yaradildi: { gte: day } } }),
        prismaUnscoped.avto_log.count({ where: { sahibkar_id: sahibkarId, yaradildi: { gte: day }, status: { not: "ok" } } }),
      ]);

      // alert_categories — global table, tenant-siz
      const catCodes = top_cats_raw.map((c) => c.kateqoriya_kod);
      const catRows = catCodes.length > 0
        ? await prismaUnscoped.alert_categories.findMany({ where: { kod: { in: catCodes } }, select: { kod: true, ad: true, emoji: true } })
        : [];
      const catMap = new Map(catRows.map((c) => [c.kod, c]));

      const ruleKods = recurring_raw.map((r) => r.rule_kod).filter((k): k is string => !!k);
      const ruleExamples = ruleKods.length > 0
        ? await prismaUnscoped.alerts.findMany({
            where: { sahibkar_id: sahibkarId, rule_kod: { in: ruleKods } },
            distinct: ["rule_kod"],
            select: { rule_kod: true, basliq: true },
          })
        : [];
      const ruleExMap = new Map(ruleExamples.map((r) => [r.rule_kod!, r.basliq]));

      // Borclu müştərilərdən 30+ gündür hərəkət olmayanlar.
      // `alacaq` field-i bizə borclu olanları göstərir (debtor_count ilə eyni semantika).
      const overdue_debt_count = await prismaUnscoped.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND COALESCE(alacaq, 0) > 0
           AND (CURRENT_DATE - GREATEST(yenilendi::date, yaradildi::date)) > 30
      `.catch(() => [{ c: 0n }]).then((r) => Number(r[0]?.c ?? 0));

    return {
      alert_open, alert_kritik, alert_today, alert_resolved_today,
      tesdiq_gozleyen, tesdiq_kritik, tesdiq_today_completed,
      task_overdue,
      stock_zero, stock_low,
      debtor_count: debtors._count._all,
      debtor_amount: Number(debtors._sum.alacaq ?? 0),
      overdue_debt: overdue_debt_count,
      late_employees_today: late_today,
      service_stalled, mp_pending,
      top_categories: top_cats_raw.map((c) => ({
        kateqoriya_kod: c.kateqoriya_kod,
        kateqoriya_ad: catMap.get(c.kateqoriya_kod)?.ad ?? c.kateqoriya_kod,
        emoji: catMap.get(c.kateqoriya_kod)?.emoji ?? null,
        count: c._count._all,
      })),
      recurring: recurring_raw.map((r) => ({
        rule_kod: r.rule_kod,
        count: r._count._all,
        example: ruleExMap.get(r.rule_kod ?? "") ?? "",
      })),
      alerts_24h,
      active_rules,
      automation_runs_24h, automation_errors_24h,
    };
  },
  ["risk-dashboard", sahibkarId],
  { revalidate: 60, tags: [`nezaret:${sahibkarId}`, `dashboard:${sahibkarId}`, `alerts:${sahibkarId}`] },
);

export async function getRiskDashboard(): Promise<RiskDashboardData> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchRiskDashboardCached(sahibkarId)();
  });
}
