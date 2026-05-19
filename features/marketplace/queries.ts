import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type MarketplaceListItem = {
  id: string;
  platform: string;
  ad: string;
  store_id: string | null;
  store_url: string | null;
  status: string;
  aktiv: boolean;
  komisyon_faiz: number;
  son_sync: Date | null;
  son_xeta: string | null;
  yaradildi: Date;
};

export type MarketplaceStats = {
  total: number;
  aktiv: number;
  bu_ay_sifaris: number;
  bu_ay_meblegh: number;
  syncs_24h: number;
};

export async function getMarketplaceAccounts(): Promise<MarketplaceListItem[]> {
  return withTenant(async () => {
    const accounts = await prisma.marketplace_hesablari.findMany({
      orderBy: { yaradildi: "desc" },
    });
    return accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      ad: a.ad,
      store_id: a.store_id,
      store_url: a.store_url,
      status: a.status,
      aktiv: a.aktiv,
      komisyon_faiz: Number(a.komisyon_faiz ?? 0),
      son_sync: a.son_sync,
      son_xeta: a.son_xeta,
      yaradildi: a.yaradildi,
    }));
  });
}

export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  return withTenant(async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [total, aktiv, syncs24, ordersAgg] = await Promise.all([
      prisma.marketplace_hesablari.count(),
      prisma.marketplace_hesablari.count({ where: { status: "aktiv" } }),
      prisma.marketplace_sync_log
        .count({ where: { yaradildi: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } })
        .catch(() => 0),
      prisma.marketplace_sifarisleri
        .aggregate({
          where: { yaradildi: { gte: monthStart } },
          _count: { id: true },
          _sum: { meblegh: true },
        })
        .catch(() => null),
    ]);

    return {
      total,
      aktiv,
      bu_ay_sifaris: ordersAgg?._count.id ?? 0,
      bu_ay_meblegh: Number(ordersAgg?._sum.meblegh ?? 0),
      syncs_24h: syncs24,
    };
  });
}

export async function getRecentMarketplaceOrders(limit = 10) {
  return withTenant(async () => {
    return prisma.marketplace_sifarisleri
      .findMany({
        orderBy: { yaradildi: "desc" },
        take: limit,
        include: {
          marketplace_magaza_hesablari: { select: { platform: true, ad: true } },
        },
      })
      .catch(() => []);
  });
}
