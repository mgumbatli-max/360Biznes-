import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type TaskAnalytics = {
  totals: {
    total: number;
    aktiv: number;
    tamamlanan_30g: number;
    gecikmis: number;
    avg_completion_hours: number | null;
  };
  by_status: { status: string; count: number }[];
  by_priority: { prioritet: string; count: number }[];
  by_assignee: { mesul_id: string; ad: string; total: number; tamamlanan: number; gecikmis: number }[];
  daily_30: { date: string; created: number; completed: number }[];
  top_overdue: { id: string; basliq: string; days_overdue: number; mesul_ad: string | null }[];
  oncoming: { id: string; basliq: string; deadline: Date | null; mesul_ad: string | null }[];
};

export async function getTaskAnalytics(): Promise<TaskAnalytics> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const month30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const next7 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const [total, aktiv, tamamlanan_30g, gecikmis, byStatus, byPriority, completionTimes, byAssigneeRaw, daily, topOverdueRaw, oncomingRaw] = await Promise.all([
      prisma.tapshiriqlar.count(),
      prisma.tapshiriqlar.count({ where: { status: { notIn: ["tamamlandi", "legv"] } } }),
      prisma.tapshiriqlar.count({ where: { status: "tamamlandi", tamamlandi_de: { gte: month30 } } }),
      prisma.tapshiriqlar.count({ where: { status: { notIn: ["tamamlandi", "legv"] }, deadline: { lt: now } } }),

      prisma.tapshiriqlar.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.tapshiriqlar.groupBy({ by: ["prioritet"], _count: { _all: true } }),

      prisma.tapshiriqlar.findMany({
        where: { status: "tamamlandi", tamamlandi_de: { gte: month30 }, yaradildi: { not: null } },
        select: { yaradildi: true, tamamlandi_de: true },
        take: 200,
      }),

      prisma.$queryRaw<{ mesul_id: string; ad: string; total: number; tamamlanan: number; gecikmis: number }[]>`
        SELECT t.mesul_id::text,
               u.ad_soyad AS ad,
               COUNT(*)::int AS total,
               SUM(CASE WHEN t.status = 'tamamlandi' THEN 1 ELSE 0 END)::int AS tamamlanan,
               SUM(CASE WHEN t.status NOT IN ('tamamlandi','legv') AND t.deadline < NOW() THEN 1 ELSE 0 END)::int AS gecikmis
          FROM tapshiriqlar t
          JOIN istifadeciler u ON u.id = t.mesul_id
         WHERE t.sahibkar_id = ${sahibkarId}::uuid
           AND t.yaradildi >= ${month30}
         GROUP BY t.mesul_id, u.ad_soyad
         ORDER BY total DESC
         LIMIT 10
      `,

      prisma.$queryRaw<{ d: Date; created: number; completed: number }[]>`
        WITH days AS (
          SELECT generate_series(${month30}::date, CURRENT_DATE, '1 day')::date AS d
        ),
        created AS (
          SELECT yaradildi::date AS d, COUNT(*)::int AS c
            FROM tapshiriqlar
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND yaradildi >= ${month30}
           GROUP BY 1
        ),
        completed AS (
          SELECT tamamlandi_de::date AS d, COUNT(*)::int AS c
            FROM tapshiriqlar
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND tamamlandi_de >= ${month30}
           GROUP BY 1
        )
        SELECT d.d,
               COALESCE(cr.c, 0)::int AS created,
               COALESCE(cm.c, 0)::int AS completed
          FROM days d
          LEFT JOIN created cr ON cr.d = d.d
          LEFT JOIN completed cm ON cm.d = d.d
         ORDER BY d.d ASC
      `,

      prisma.tapshiriqlar.findMany({
        where: { status: { notIn: ["tamamlandi", "legv"] }, deadline: { lt: now, not: null } },
        orderBy: { deadline: "asc" },
        take: 8,
        include: { istifadeciler_tapshiriqlar_mesul_idToistifadeciler: { select: { ad_soyad: true } } },
      }),

      prisma.tapshiriqlar.findMany({
        where: { status: { notIn: ["tamamlandi", "legv"] }, deadline: { gte: now, lte: next7 } },
        orderBy: { deadline: "asc" },
        take: 8,
        include: { istifadeciler_tapshiriqlar_mesul_idToistifadeciler: { select: { ad_soyad: true } } },
      }),
    ]);

    let totalMs = 0, c = 0;
    for (const r of completionTimes) {
      if (r.yaradildi && r.tamamlandi_de) {
        totalMs += r.tamamlandi_de.getTime() - r.yaradildi.getTime();
        c++;
      }
    }
    const avg_completion_hours = c > 0 ? totalMs / c / 3_600_000 : null;

    return {
      totals: { total, aktiv, tamamlanan_30g, gecikmis, avg_completion_hours },
      by_status: byStatus.map((s) => ({ status: s.status ?? "?", count: s._count._all })),
      by_priority: byPriority.map((p) => ({ prioritet: p.prioritet ?? "normal", count: p._count._all })),
      by_assignee: byAssigneeRaw.map((r) => ({ ...r, total: Number(r.total), tamamlanan: Number(r.tamamlanan), gecikmis: Number(r.gecikmis) })),
      daily_30: daily.map((d) => ({ date: d.d.toISOString().slice(0, 10), created: Number(d.created), completed: Number(d.completed) })),
      top_overdue: topOverdueRaw.map((t) => ({
        id: t.id,
        basliq: t.basliq,
        days_overdue: t.deadline ? Math.floor((now.getTime() - t.deadline.getTime()) / 86_400_000) : 0,
        mesul_ad: t.istifadeciler_tapshiriqlar_mesul_idToistifadeciler?.ad_soyad ?? null,
      })),
      oncoming: oncomingRaw.map((t) => ({
        id: t.id,
        basliq: t.basliq,
        deadline: t.deadline,
        mesul_ad: t.istifadeciler_tapshiriqlar_mesul_idToistifadeciler?.ad_soyad ?? null,
      })),
    };
  });
}
