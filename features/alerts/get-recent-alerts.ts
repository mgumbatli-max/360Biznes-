import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type RecentAlert = {
  id: string;
  basliq: string;
  seviyye: string;
  status: string;
  kateqoriya_ad: string;
  kateqoriya_emoji: string | null;
  first_seen_at: Date | null;
};

export type RecentAlertsResult = {
  items: RecentAlert[];
  unreadCount: number;
};

const OPEN_STATUSES = ["yeni", "baxilir"];

async function fetchAlerts(sahibkarId: string, limit: number): Promise<RecentAlertsResult> {
  const [items, unreadCount] = await Promise.all([
    prismaUnscoped.alerts.findMany({
      where: { sahibkar_id: sahibkarId, status: { in: OPEN_STATUSES } },
      orderBy: [{ seviyye: "desc" }, { first_seen_at: "desc" }],
      take: limit,
      include: { alert_categories: { select: { ad: true, emoji: true } } },
    }),
    prismaUnscoped.alerts.count({ where: { sahibkar_id: sahibkarId, status: "yeni" } }),
  ]);
  return {
    items: items.map((a) => ({
      id: a.id,
      basliq: a.basliq,
      seviyye: a.seviyye,
      status: a.status,
      kateqoriya_ad: a.alert_categories.ad,
      kateqoriya_emoji: a.alert_categories.emoji,
      first_seen_at: a.first_seen_at,
    })),
    unreadCount,
  };
}

/**
 * Topbar bell — hər naviqasiyada 2 DB query (`findMany` + `count`) çağırırdı.
 * İndi (sahibkar_id, limit) açarlı 30s TTL cross-request cache.
 * Alert yaradıldıqda action tərəfi tag-i geri çağırır (kritiklik aşağı olduğu
 * üçün TTL fallback yetərlidir).
 */
export const getRecentAlerts = cache(async (limit = 10): Promise<RecentAlertsResult> => {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => fetchAlerts(sahibkarId, limit),
      ["recent-alerts", sahibkarId, String(limit)],
      { revalidate: 30, tags: [`alerts:${sahibkarId}`] },
    );
    return cached();
  });
});
