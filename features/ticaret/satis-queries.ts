import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { getStealthState } from "@/lib/stealth/server";

export type SaleListItem = {
  id: string;
  nomre: string;
  tarix: Date;
  status: string;
  odenis_nov: string;
  umumi_mebleg: number;
  endirim_mebleg: number;
  son_mebleg: number;
  odenilmis: number;
  musteri_id: string | null;
  musteri_ad: string | null;
  satici_ad: string | null;
  yaradan_ad: string | null;
  anbar_ad: string | null;
  filial_ad: string | null;
  kassa_ad: string | null;
  satir_say: number;
  qaralama: boolean;
  maya_alti: boolean;
  qaime_nomresi: string | null;
  cek_nomresi: string | null;
  cek_status: string | null;
  cek_nov: string | null;
  marketplace_platform: string | null;
  qeyd: string | null;
  vergi_kassasina_vur: boolean;
  yaradildi: Date | null;
  yenilendi: Date | null;
};

export type SaleFilter = {
  search?: string;
  status?: string[];
  odenis_nov?: string[];
  from?: Date;
  to?: Date;
  borc?: "var" | "yox" | "any";
};

export type SaleStats = {
  bugun: { count: number; mebleg: number };
  bu_hefte: { count: number; mebleg: number };
  bu_ay: { count: number; mebleg: number };
  borc_mebleg: number;
};

export async function getSaleStats(): Promise<SaleStats> {
  return withTenant(async () => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [b, h, a, borc] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: today }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: weekStart }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: monthStart }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(son_mebleg - COALESCE(odenilmis, 0)), 0)::float AS total
          FROM satis_sifarisleri
         WHERE sahibkar_id = (SELECT sahibkar_id FROM satis_sifarisleri LIMIT 1)
           AND status NOT IN ('legv')
           AND qaralama IS NOT TRUE
      `,
    ]);

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      bugun: { count: b._count._all, mebleg: Number(b._sum.son_mebleg ?? 0) * s },
      bu_hefte: { count: h._count._all, mebleg: Number(h._sum.son_mebleg ?? 0) * s },
      bu_ay: { count: a._count._all, mebleg: Number(a._sum.son_mebleg ?? 0) * s },
      borc_mebleg: Number(borc[0]?.total ?? 0) * s,
    };
  });
}

export async function getSales(
  filter: SaleFilter,
  page = 1,
  pageSize = 50
): Promise<{ items: SaleListItem[]; total: number }> {
  // Server-tərəfli hard cap — malicious / yanlışca verilən pageSize=10000 DB-ni
  // və serializasiyanı bloklamasın deyə. 100 sətir UI üçün də praktiki maksimum.
  pageSize = Math.min(Math.max(1, pageSize), 100);
  page = Math.max(1, page);
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { qaralama: { not: true } };
    if (filter.status?.length) where.status = { in: filter.status };
    if (filter.odenis_nov?.length) where.odenis_nov = { in: filter.odenis_nov };
    if (filter.from || filter.to) {
      where.tarix = {};
      if (filter.from) where.tarix.gte = filter.from;
      if (filter.to) where.tarix.lte = filter.to;
    }
    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { nomre: { contains: q, mode: "insensitive" } },
        { kontragentler: { ad: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (filter.borc === "var") {
      where.AND = [
        ...(where.AND ?? []),
        { son_mebleg: { gt: 0 } },
        {
          OR: [
            { odenilmis: null },
            { odenilmis: { lt: prisma.satis_sifarisleri.fields.son_mebleg } },
          ],
        },
      ];
    } else if (filter.borc === "yox") {
      // Sales fully paid (odenilmis >= son_mebleg) — simplified to status='tamamlandi'.
      where.status = { in: ["tamamlandi"] };
    }

    const [items, total] = await Promise.all([
      prisma.satis_sifarisleri.findMany({
        where,
        orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          kontragentler: { select: { id: true, ad: true } },
          istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler: { select: { ad_soyad: true } },
          istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
          anbarlar: { select: { ad: true } },
          filiallar: { select: { ad: true } },
          kassalar: { select: { ad: true } },
          _count: { select: { satis_sifaris_satirlari: true } },
        },
      }),
      prisma.satis_sifarisleri.count({ where }),
    ]);

    return {
      items: items.map((s) => ({
        id: s.id,
        nomre: s.nomre,
        tarix: s.tarix,
        status: s.status ?? "yeni",
        odenis_nov: s.odenis_nov ?? "negd",
        umumi_mebleg: Number(s.umumi_mebleg ?? 0),
        endirim_mebleg: Number(s.endirim_mebleg ?? 0),
        son_mebleg: Number(s.son_mebleg ?? 0),
        odenilmis: Number(s.odenilmis ?? 0),
        musteri_id: s.musteri_id,
        musteri_ad: s.kontragentler?.ad ?? null,
        satici_ad: s.istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler?.ad_soyad ?? null,
        yaradan_ad: s.istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad ?? null,
        anbar_ad: s.anbarlar?.ad ?? null,
        filial_ad: s.filiallar?.ad ?? null,
        kassa_ad: s.kassalar?.ad ?? null,
        satir_say: s._count.satis_sifaris_satirlari,
        qaralama: s.qaralama ?? false,
        maya_alti: s.maya_alti ?? false,
        qaime_nomresi: s.qaime_nomresi ?? null,
        cek_nomresi: s.cek_nomresi ?? null,
        cek_status: s.cek_status ?? null,
        cek_nov: s.cek_nov ?? null,
        marketplace_platform: s.marketplace_platform ?? null,
        qeyd: s.qeyd ?? null,
        vergi_kassasina_vur: s.vergi_kassasina_vur ?? false,
        yaradildi: s.yaradildi ?? null,
        yenilendi: s.yenilendi ?? null,
      })),
      total,
    };
  });
}

export async function getSaleDetail(id: string) {
  return withTenant(async () => {
    return prisma.satis_sifarisleri.findUnique({
      where: { id },
      include: {
        kontragentler: { select: { id: true, ad: true, telefon: true } },
        istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler: { select: { ad_soyad: true } },
        istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
        anbarlar: { select: { ad: true } },
        satis_sifaris_satirlari: {
          include: { mehsullar: { select: { ad: true, kod: true } } },
          orderBy: { id: "asc" },
        },
      },
    });
  });
}
