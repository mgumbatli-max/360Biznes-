import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export async function getRules() {
  return withTenant(async () =>
    prisma.avto_qayda.findMany({
      orderBy: [{ aktiv: "desc" }, { ad: "asc" }],
      include: { _count: { select: { avto_log: true } } },
    })
  );
}

export async function getRuleStats() {
  return withTenant(async () => {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [total, aktiv, log24h, xeta24] = await Promise.all([
      prisma.avto_qayda.count(),
      prisma.avto_qayda.count({ where: { aktiv: true } }),
      prisma.avto_log.count({ where: { yaradildi: { gte: since } } }),
      prisma.avto_log.count({ where: { yaradildi: { gte: since }, status: { not: "ok" } } }),
    ]);
    return { total, aktiv, passiv: total - aktiv, log24h, xeta24 };
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
