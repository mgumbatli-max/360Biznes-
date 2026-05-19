import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type WebhookListItem = {
  id: string;
  ad: string;
  url: string;
  events: string[];
  aktiv: boolean;
  retry_max: number;
  cagiris_sayi: number;
  ugurlu_sayi: number;
  son_ugur: Date | null;
  son_u_ursuz: Date | null;
  son_xeta: string | null;
  yaradildi: Date;
  delivery_count: number;
  son_status: number | null;
};

export type WebhookStats = {
  total: number;
  aktiv: number;
  passiv: number;
  last24: number;
  fail24: number;
};

export async function getWebhooks(filter?: {
  event?: string;
  aktiv?: boolean;
}): Promise<WebhookListItem[]> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter?.event) where.events = { has: filter.event };
    if (filter?.aktiv !== undefined) where.aktiv = filter.aktiv;

    const rows = await prisma.webhook_endpoints.findMany({
      where,
      orderBy: [{ aktiv: "desc" }, { yaradildi: "desc" }],
      include: {
        _count: { select: { webhook_delivery: true } },
        webhook_delivery: {
          orderBy: { yaradildi: "desc" },
          take: 1,
          select: { http_status: true },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      url: r.url,
      events: r.events,
      aktiv: r.aktiv,
      retry_max: r.retry_max,
      cagiris_sayi: r.cagiris_sayi,
      ugurlu_sayi: r.ugurlu_sayi,
      son_ugur: r.son_ugur,
      son_u_ursuz: r.son_u_ursuz,
      son_xeta: r.son_xeta,
      yaradildi: r.yaradildi,
      delivery_count: r._count.webhook_delivery,
      son_status: r.webhook_delivery[0]?.http_status ?? null,
    }));
  });
}

export async function getWebhookStats(): Promise<WebhookStats> {
  return withTenant(async () => {
    const since24 = new Date(Date.now() - 24 * 3600 * 1000);
    const [total, aktiv, last24, fail24] = await Promise.all([
      prisma.webhook_endpoints.count(),
      prisma.webhook_endpoints.count({ where: { aktiv: true } }),
      prisma.webhook_delivery.count({ where: { yaradildi: { gte: since24 } } }),
      prisma.webhook_delivery.count({
        where: { yaradildi: { gte: since24 }, http_status: { gte: 400 } },
      }),
    ]);
    return { total, aktiv, passiv: total - aktiv, last24, fail24 };
  });
}

export async function getRecentDeliveries(limit = 20) {
  return withTenant(async () => {
    return prisma.webhook_delivery.findMany({
      orderBy: { yaradildi: "desc" },
      take: limit,
      include: { webhook_endpoints: { select: { ad: true } } },
    });
  });
}
