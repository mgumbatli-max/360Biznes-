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
