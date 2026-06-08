import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type MarketplacePaymentFilter = {
  platforma?: string;
  status?: string;
  from?: Date;
  to?: Date;
};

export type MarketplacePaymentRow = {
  id: number;
  hesab_id: string | null;
  platforma: string;
  magaza: string | null;
  donem_baslama: Date;
  donem_bitme: Date;
  gozlenen: number;
  banka_dushen: number;
  komissiya: number;
  qaytarma: number;
  ferq: number;
  status: string;
  hesab_ad: string | null;
  qeyd: string | null;
  yaradildi: Date | null;
};

export async function getMarketplacePayments(
  filter: MarketplacePaymentFilter = {},
): Promise<MarketplacePaymentRow[]> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter.platforma) where.platforma = filter.platforma;
    if (filter.status) where.status = filter.status;
    if (filter.from || filter.to) {
      where.donem_baslama = {};
      if (filter.from) where.donem_baslama.gte = filter.from;
      if (filter.to) where.donem_baslama.lte = filter.to;
    }
    try {
      const rows = await prisma.finance_marketplace_payments.findMany({
        where,
        orderBy: [{ donem_bitme: "desc" }],
        take: 200,
        include: { maliye_hesablari: { select: { ad: true } } },
      });
      return rows.map((r) => ({
        id: r.id,
        hesab_id: r.hesab_id ?? null,
        platforma: r.platforma,
        magaza: r.magaza ?? null,
        donem_baslama: r.donem_baslama,
        donem_bitme: r.donem_bitme,
        gozlenen: Number(r.gozlenen_meblegh ?? 0),
        banka_dushen: Number(r.banka_dushen ?? 0),
        komissiya: Number(r.komissiya ?? 0),
        qaytarma: Number(r.qaytarma_meblegh ?? 0),
        ferq: Number(r.ferq ?? 0),
        status: r.status ?? "gozleyir",
        hesab_ad: r.maliye_hesablari?.ad ?? null,
        qeyd: r.qeyd ?? null,
        yaradildi: r.yaradildi ?? null,
      }));
    } catch {
      return [];
    }
  });
}

export type PlatformCard = {
  platforma: string;
  sifaris_say: number;
  brut: number;
  komissiya: number;
  net: number;
  son_donem: Date | null;
};

/**
 * Per-platform monthly stats for marketplace dashboard cards.
 * Aggregates from satis_sifarisleri marketplace fields (this month).
 */
export async function getMarketplacePlatformCards(): Promise<PlatformCard[]> {
  return withTenant(async () => {
    try {
      const { sahibkarId } = requireTenant();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      // ⚠️ Köhnə kod-da `WHERE tarix >= ...` (sahibkar_id filter yox idi)
      // — bütün tenant-ların marketplace satışlarını birləşdirirdi.
      const rows = await prisma.$queryRaw<{
        platforma: string;
        sifaris_say: number;
        brut: number;
        komissiya: number;
        net: number;
        son_donem: Date | null;
      }[]>`
        SELECT COALESCE(marketplace_platform, '—') AS platforma,
               COUNT(*)::int AS sifaris_say,
               COALESCE(SUM(son_mebleg), 0)::float AS brut,
               COALESCE(SUM(komisyon_meblegh), 0)::float AS komissiya,
               COALESCE(SUM(COALESCE(xalis_meblegh, son_mebleg - COALESCE(komisyon_meblegh, 0))), 0)::float AS net,
               MAX(tarix) AS son_donem
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix >= ${monthStart}
           AND status != 'legv'
           AND marketplace_platform IS NOT NULL
         GROUP BY marketplace_platform
         ORDER BY brut DESC
      `;
      return rows.map((r) => ({
        platforma: r.platforma,
        sifaris_say: Number(r.sifaris_say),
        brut: Number(r.brut),
        komissiya: Number(r.komissiya),
        net: Number(r.net),
        son_donem: r.son_donem ?? null,
      }));
    } catch {
      return [];
    }
  });
}

export async function getMarketplaceStats() {
  return withTenant(async () => {
    try {
      const [gozleyir, odenildi] = await Promise.all([
        prisma.finance_marketplace_payments.aggregate({
          where: { status: "gozleyir" },
          _sum: { gozlenen_meblegh: true },
          _count: { _all: true },
        }),
        prisma.finance_marketplace_payments.aggregate({
          where: { status: "odenildi" },
          _sum: { banka_dushen: true },
          _count: { _all: true },
        }),
      ]);
      return {
        gozleyir_say: gozleyir._count._all,
        gozleyir_mebleg: Number(gozleyir._sum.gozlenen_meblegh ?? 0),
        odenildi_say: odenildi._count._all,
        odenildi_mebleg: Number(odenildi._sum.banka_dushen ?? 0),
      };
    } catch {
      return { gozleyir_say: 0, gozleyir_mebleg: 0, odenildi_say: 0, odenildi_mebleg: 0 };
    }
  });
}
