import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { DateRange } from "./shared";

export type PlatformStat = {
  platform: string;
  orders: number;
  brut: number;
  komisyon: number;
  xalis: number;
};

export async function getPlatformBreakdown(range: DateRange): Promise<PlatformStat[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    // Use satis_sifarisleri marketplace_platform field (more reliable than marketplace_sifarisleri which is order intake)
    const rows = await prisma.$queryRaw<PlatformStat[]>`
      SELECT COALESCE(marketplace_platform, '—') AS platform,
             COUNT(*)::int AS orders,
             COALESCE(SUM(son_mebleg), 0)::float AS brut,
             COALESCE(SUM(komisyon_meblegh), 0)::float AS komisyon,
             COALESCE(SUM(COALESCE(xalis_meblegh, son_mebleg - COALESCE(komisyon_meblegh, 0))), 0)::float AS xalis
        FROM satis_sifarisleri
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix BETWEEN ${range.from} AND ${range.to}
         AND status != 'legv'
         AND marketplace_platform IS NOT NULL
       GROUP BY marketplace_platform
       ORDER BY brut DESC
    `.catch(() => [] as PlatformStat[]);
    return rows.map((r) => ({
      ...r,
      orders: Number(r.orders),
      brut: Number(r.brut),
      komisyon: Number(r.komisyon),
      xalis: Number(r.xalis),
    }));
  });
}

export type PlatformProduct = { platform: string; mehsul_id: string; ad: string; satilan: number; gelir: number };

export type PlatformDrilldown = {
  topProducts: { ad: string; satilan: number; gelir: number }[];
  topCustomers: { ad: string; orders: number; cemi: number }[];
  daily: { tarix: string; cemi: number; sayi: number }[];
};

export async function getPlatformDrilldown(range: DateRange, platform: string): Promise<PlatformDrilldown> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [productsRows, customersRows, dailyRows] = await Promise.all([
      prisma.$queryRaw<{ ad: string; satilan: number; gelir: number }[]>`
        SELECT m.ad,
               SUM(sls.miqdar)::float AS satilan,
               SUM(sls.cemi)::float AS gelir
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          JOIN mehsullar m ON m.id = sls.mehsul_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix BETWEEN ${range.from} AND ${range.to}
           AND ss.status != 'legv'
           AND ss.marketplace_platform = ${platform}
         GROUP BY m.id, m.ad
         ORDER BY gelir DESC
         LIMIT 10
      `.catch(() => [] as { ad: string; satilan: number; gelir: number }[]),
      prisma.$queryRaw<{ ad: string; orders: number; cemi: number }[]>`
        SELECT COALESCE(k.ad, '—') AS ad,
               COUNT(*)::int AS orders,
               COALESCE(SUM(ss.son_mebleg), 0)::float AS cemi
          FROM satis_sifarisleri ss
          LEFT JOIN kontragentler k ON k.id = ss.musteri_id
         WHERE ss.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix BETWEEN ${range.from} AND ${range.to}
           AND ss.status != 'legv'
           AND ss.marketplace_platform = ${platform}
         GROUP BY k.ad
         ORDER BY cemi DESC
         LIMIT 10
      `.catch(() => [] as { ad: string; orders: number; cemi: number }[]),
      prisma.$queryRaw<{ tarix: string; cemi: number; sayi: number }[]>`
        SELECT to_char(tarix, 'YYYY-MM-DD') AS tarix,
               COALESCE(SUM(son_mebleg), 0)::float AS cemi,
               COUNT(*)::int AS sayi
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix BETWEEN ${range.from} AND ${range.to}
           AND status != 'legv'
           AND marketplace_platform = ${platform}
         GROUP BY tarix
         ORDER BY tarix ASC
      `.catch(() => [] as { tarix: string; cemi: number; sayi: number }[]),
    ]);
    return {
      topProducts: productsRows.map((r) => ({ ad: r.ad, satilan: Number(r.satilan), gelir: Number(r.gelir) })),
      topCustomers: customersRows.map((r) => ({ ad: r.ad, orders: Number(r.orders), cemi: Number(r.cemi) })),
      daily: dailyRows.map((r) => ({ tarix: r.tarix, cemi: Number(r.cemi), sayi: Number(r.sayi) })),
    };
  });
}

export async function getTopProductsByPlatform(range: DateRange, limitPerPlatform = 5): Promise<PlatformProduct[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<PlatformProduct[]>`
      WITH ranked AS (
        SELECT COALESCE(ss.marketplace_platform, '—') AS platform,
               m.id::text AS mehsul_id, m.ad,
               SUM(sls.miqdar)::float AS satilan,
               SUM(sls.cemi)::float AS gelir,
               row_number() OVER (
                 PARTITION BY ss.marketplace_platform ORDER BY SUM(sls.cemi) DESC
               ) AS rn
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          JOIN mehsullar m ON m.id = sls.mehsul_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix BETWEEN ${range.from} AND ${range.to}
           AND ss.status != 'legv'
           AND ss.marketplace_platform IS NOT NULL
         GROUP BY ss.marketplace_platform, m.id, m.ad
      )
      SELECT platform, mehsul_id, ad, satilan, gelir
        FROM ranked
       WHERE rn <= ${limitPerPlatform}
       ORDER BY platform, gelir DESC
    `.catch(() => [] as PlatformProduct[]);
    return rows.map((r) => ({ ...r, satilan: Number(r.satilan), gelir: Number(r.gelir) }));
  });
}
