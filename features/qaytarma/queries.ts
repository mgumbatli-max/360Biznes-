import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type ReturnFilter = {
  search?: string;
  nov?: "satis_qaytarma" | "alis_qaytarma";
  status?: string;
  kontragent_id?: string;
  anbar_id?: number;
  from?: Date;
  to?: Date;
};

export type ReturnRow = {
  id: string;
  nomre: string;
  nov: string;
  tarix: Date;
  status: string;
  umumi_mebleg: number;
  geri_qaytarildi: number;
  sebeb: string | null;
  kontragent_id: string | null;
  kontragent_ad: string | null;
  anbar_id: number;
  anbar_ad: string | null;
  satir_say: number;
};

export async function getReturns(filter: ReturnFilter = {}): Promise<ReturnRow[]> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter.nov) where.nov = filter.nov;
    if (filter.status) where.status = filter.status;
    if (filter.kontragent_id) where.kontragent_id = filter.kontragent_id;
    if (filter.anbar_id) where.anbar_id = filter.anbar_id;
    if (filter.from || filter.to) {
      where.tarix = {};
      if (filter.from) where.tarix.gte = filter.from;
      if (filter.to) where.tarix.lte = filter.to;
    }
    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { nomre: { contains: q, mode: "insensitive" } },
        { sebeb: { contains: q, mode: "insensitive" } },
        { kontragentler: { ad: { contains: q, mode: "insensitive" } } },
      ];
    }

    const rows = await prisma.qaytarma_sifarisleri.findMany({
      where,
      orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
      take: 200,
      include: {
        kontragentler: { select: { id: true, ad: true } },
        anbarlar: { select: { ad: true } },
        _count: { select: { qaytarma_satirlari: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      nomre: r.nomre,
      nov: r.nov,
      tarix: r.tarix,
      status: r.status ?? "tesdiqlenmemis",
      umumi_mebleg: Number(r.umumi_mebleg),
      geri_qaytarildi: Number(r.geri_qaytarildi),
      sebeb: r.sebeb,
      kontragent_id: r.kontragent_id,
      kontragent_ad: r.kontragentler?.ad ?? null,
      anbar_id: r.anbar_id,
      anbar_ad: r.anbarlar?.ad ?? null,
      satir_say: r._count.qaytarma_satirlari,
    }));
  });
}

export async function getReturnStats() {
  return withTenant(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [bu_ay, gozleyen, tamamlanan] = await Promise.all([
      prisma.qaytarma_sifarisleri.aggregate({
        where: { tarix: { gte: monthStart } },
        _sum: { umumi_mebleg: true },
        _count: { _all: true },
      }),
      prisma.qaytarma_sifarisleri.count({ where: { status: "tesdiqlenmemis" } }),
      prisma.qaytarma_sifarisleri.count({ where: { status: "tamamlandi" } }),
    ]);

    return {
      bu_ay_count: bu_ay._count._all,
      bu_ay_mebleg: Number(bu_ay._sum.umumi_mebleg ?? 0),
      gozleyen,
      tamamlanan,
    };
  });
}

export async function getReturnFilterOptions() {
  return withTenant(async () => {
    const [anbarlar, musteriler, mehsullar] = await Promise.all([
      prisma.anbarlar.findMany({
        where: { aktiv: true },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true },
      }),
      prisma.kontragentler.findMany({
        orderBy: { ad: "asc" },
        take: 500,
        select: { id: true, ad: true },
      }),
      prisma.mehsullar.findMany({
        where: { aktiv: true },
        orderBy: { ad: "asc" },
        take: 500,
        select: { id: true, ad: true, kod: true, satis_qiymeti: true },
      }),
    ]);
    return {
      anbarlar,
      musteriler,
      mehsullar: mehsullar.map((m) => ({
        id: m.id,
        ad: m.ad,
        kod: m.kod,
        satis_qiymeti: Number(m.satis_qiymeti ?? 0),
      })),
    };
  });
}
