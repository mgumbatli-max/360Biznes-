import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

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
      // QA-perf: map yalnız bu sahələri işlədir → select (əvvəl bütün sütunlar, o cümlədən API açar/token çəkilirdi).
      select: {
        id: true, platform: true, ad: true, store_id: true, store_url: true, status: true,
        aktiv: true, komisyon_faiz: true, son_sync: true, son_xeta: true, yaradildi: true,
      },
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

const fetchMarketplaceStatsCached = (sahibkarId: string) =>
  unstable_cache(
    async (): Promise<MarketplaceStats> => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [total, aktiv, syncs24, ordersAgg] = await Promise.all([
        prismaUnscoped.marketplace_hesablari.count({ where: { sahibkar_id: sahibkarId } }),
        prismaUnscoped.marketplace_hesablari.count({ where: { sahibkar_id: sahibkarId, status: "aktiv" } }),
        prismaUnscoped.marketplace_sync_log
          .count({ where: { sahibkar_id: sahibkarId, yaradildi: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } })
          .catch(() => 0),
        prismaUnscoped.marketplace_sifarisleri
          .aggregate({
            where: { sahibkar_id: sahibkarId, yaradildi: { gte: monthStart } },
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
    },
    ["marketplace-stats", sahibkarId],
    { revalidate: 60, tags: [`marketplace:${sahibkarId}`, `dashboard:${sahibkarId}`] },
  );

export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchMarketplaceStatsCached(sahibkarId)();
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
