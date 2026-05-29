import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

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

export const getRecentAlerts = cache(async (limit = 10): Promise<RecentAlertsResult> => {
  return withTenant(async () => {
    const [items, unreadCount] = await Promise.all([
      prisma.alerts.findMany({
        where: { status: { in: OPEN_STATUSES } },
        orderBy: [{ seviyye: "desc" }, { first_seen_at: "desc" }],
        take: limit,
        include: { alert_categories: { select: { ad: true, emoji: true } } },
      }),
      prisma.alerts.count({ where: { status: "yeni" } }),
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
  });
});
