import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type MultiSyncStats = {
  hesab_total: number;
  hesab_aktiv: number;
  cem_sifaris_24s: number;
  cem_sifaris_ay: number;
  cem_meblegh_ay: number;
  sync_24s: number;
  syncsiz_hesab: number;
};

export type UnifiedOrder = {
  id: string;
  platform: string;
  hesab_ad: string;
  xarici_nomre: string;
  musteri_ad: string | null;
  musteri_telefon: string | null;
  mehsul_ad: string | null;
  sayi: number;
  meblegh: number;
  status: string;
  yaradildi: Date;
  erp_satis_id: string | null;
  son_muddet: Date | null;
};

export type SyncCandidate = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  sekil_url: string | null;
  cem_stok: number;
  satis_qiymeti: number;
  son_yenileme: Date | null;
};

export async function getMultiSyncStats(): Promise<MultiSyncStats> {
  return withTenant(async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const dayAgo = new Date(Date.now() - 24 * 3600_000);

    const [hesab_total, hesab_aktiv, sif_24s, ay_agg, sync_24s, hesablar] = await Promise.all([
      prisma.marketplace_hesablari.count(),
      prisma.marketplace_hesablari.count({ where: { aktiv: true } }),
      prisma.marketplace_sifarisleri.count({ where: { yaradildi: { gte: dayAgo } } }).catch(() => 0),
      prisma.marketplace_sifarisleri
        .aggregate({
          where: { yaradildi: { gte: monthStart } },
          _count: { id: true },
          _sum: { meblegh: true },
        })
        .catch(() => null),
      prisma.marketplace_sync_log
        .count({ where: { yaradildi: { gte: dayAgo } } })
        .catch(() => 0),
      prisma.marketplace_hesablari.findMany({
        where: { aktiv: true },
        select: { son_sync: true },
      }),
    ]);

    // 24+ saat sync olmayan hesab sayı
    const syncsiz_hesab = hesablar.filter(
      (h) => !h.son_sync || h.son_sync.getTime() < dayAgo.getTime(),
    ).length;

    return {
      hesab_total,
      hesab_aktiv,
      cem_sifaris_24s: sif_24s,
      cem_sifaris_ay: ay_agg?._count.id ?? 0,
      cem_meblegh_ay: Number(ay_agg?._sum.meblegh ?? 0),
      sync_24s,
      syncsiz_hesab,
    };
  });
}

/** Bütün marketplace-lərdən gələn sifarişlər unified cədvəldə */
export async function getUnifiedOrders(filter: {
  platform?: string;
  status?: string;
  search?: string;
  limit?: number;
} = {}): Promise<UnifiedOrder[]> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter.platform) {
      where.marketplace_magaza_hesablari = { is: { platform: filter.platform } };
    }
    if (filter.status) where.status = filter.status;
    if (filter.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { xarici_nomre: { contains: q, mode: "insensitive" } },
        { musteri_ad: { contains: q, mode: "insensitive" } },
        { musteri_telefon: { contains: q } },
        { mehsul_ad: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await prisma.marketplace_sifarisleri.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: filter.limit ?? 100,
      include: {
        marketplace_magaza_hesablari: { select: { platform: true, ad: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      platform: r.marketplace_magaza_hesablari?.platform ?? "—",
      hesab_ad: r.marketplace_magaza_hesablari?.ad ?? "—",
      xarici_nomre: r.xarici_nomre,
      musteri_ad: r.musteri_ad,
      musteri_telefon: r.musteri_telefon,
      mehsul_ad: r.mehsul_ad,
      sayi: Number(r.sayi ?? 0),
      meblegh: Number(r.meblegh ?? 0),
      status: r.status,
      yaradildi: r.yaradildi,
      erp_satis_id: r.erp_satis_id,
      son_muddet: r.son_muddet,
    }));
  });
}

/** Sync olunmalı məhsulların siyahısı — stoku son 24 saatda dəyişənlər */
export async function getSyncCandidates(): Promise<SyncCandidate[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    // 24 saat ərzində son satış/alış olan və ya stok dəyişən məhsullar
    const dayAgo = new Date(Date.now() - 24 * 3600_000);
    const rows = await prisma.mehsullar.findMany({
      where: {
        sahibkar_id: sahibkarId,
        aktiv: true,
        OR: [
          { yenilendi: { gte: dayAgo } },
          { son_satis_de: { gte: dayAgo } },
        ],
      },
      select: {
        id: true,
        ad: true,
        kod: true,
        sekil_url: true,
        satis_qiymeti: true,
        yenilendi: true,
        stok: { select: { miqdar: true } },
      },
      orderBy: { yenilendi: "desc" },
      take: 50,
    });
    return rows.map((m) => ({
      mehsul_id: m.id,
      ad: m.ad,
      kod: m.kod,
      sekil_url: m.sekil_url,
      cem_stok: m.stok.reduce((s, x) => s + Number(x.miqdar ?? 0), 0),
      satis_qiymeti: Number(m.satis_qiymeti ?? 0),
      son_yenileme: m.yenilendi,
    }));
  });
}
