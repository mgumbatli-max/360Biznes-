import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export async function getRules() {
  return withTenant(async () =>
    prisma.avto_qayda.findMany({
      orderBy: [{ aktiv: "desc" }, { ad: "asc" }],
      include: { _count: { select: { avto_log: true } } },
    })
  );
}

const fetchRuleStatsCached = (sahibkarId: string) =>
  unstable_cache(
    async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      const [total, aktiv, log24h, xeta24] = await Promise.all([
        prismaUnscoped.avto_qayda.count({ where: { sahibkar_id: sahibkarId } }),
        prismaUnscoped.avto_qayda.count({ where: { sahibkar_id: sahibkarId, aktiv: true } }),
        prismaUnscoped.avto_log.count({ where: { sahibkar_id: sahibkarId, yaradildi: { gte: since } } }),
        prismaUnscoped.avto_log.count({
          where: { sahibkar_id: sahibkarId, yaradildi: { gte: since }, status: { not: "ok" } },
        }),
      ]);
      return { total, aktiv, passiv: total - aktiv, log24h, xeta24 };
    },
    ["avto-rule-stats", sahibkarId],
    { revalidate: 60, tags: [`avtomatlasdirma:${sahibkarId}`] },
  );

export async function getRuleStats() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchRuleStatsCached(sahibkarId)();
  });
}

export async function getRecentLogs(limit = 20) {
  return withTenant(async () =>
    prisma.avto_log.findMany({
      orderBy: { yaradildi: "desc" },
      take: limit,
      include: { avto_qayda: { select: { ad: true } } },
    })
  );
}

/**
 * Ən aktiv 3 qayda + ən çox xəta verən qaydanı qaytarır.
 * Dashboard-da "Smart insights" paneli üçün istifadə olunur.
 */
export async function getRuleInsights() {
  return withTenant(async () => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    // QA-perf: topActive/topErrors müstəqil idi (serial) → Promise.all (paralel).
    const [topActive, topErrors] = await Promise.all([
      // Son 7 gündə ən çox icra olunan qaydalar (top 3)
      prisma.avto_log.groupBy({
        by: ["qayda_id"],
        where: { yaradildi: { gte: since }, qayda_id: { not: null } },
        _count: true,
        orderBy: { _count: { qayda_id: "desc" } },
        take: 3,
      }),
      // Son 7 gündə ən çox xəta verən qayda
      prisma.avto_log.groupBy({
        by: ["qayda_id"],
        where: { yaradildi: { gte: since }, qayda_id: { not: null }, status: { not: "ok" } },
        _count: true,
        orderBy: { _count: { qayda_id: "desc" } },
        take: 1,
      }),
    ]);

    // Detalları çək
    const allIds = [...topActive.map((x) => x.qayda_id), ...topErrors.map((x) => x.qayda_id)].filter(
      (x): x is number => x !== null,
    );
    const ruleAds =
      allIds.length > 0
        ? await prisma.avto_qayda.findMany({
            where: { id: { in: allIds } },
            select: { id: true, ad: true, aktiv: true },
          })
        : [];
    const ruleMap = new Map(ruleAds.map((r) => [r.id, r]));

    return {
      topActive: topActive
        .filter((x) => x.qayda_id !== null)
        .map((x) => ({
          id: x.qayda_id as number,
          ad: ruleMap.get(x.qayda_id as number)?.ad ?? "—",
          aktiv: ruleMap.get(x.qayda_id as number)?.aktiv ?? false,
          icra: x._count,
        })),
      topError:
        topErrors[0] && topErrors[0].qayda_id !== null
          ? {
              id: topErrors[0].qayda_id,
              ad: ruleMap.get(topErrors[0].qayda_id)?.ad ?? "—",
              xeta: topErrors[0]._count,
            }
          : null,
    };
  });
}
