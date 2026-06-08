import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { getStealthState } from "@/lib/stealth/server";

export type TeklifLineSummary = {
  ad: string;
  kod: string | null;
  miqdar: number;
  qiymet: number;
  cemi: number;
};

export type TeklifListItem = {
  id: string;
  nomre: string;
  tarix: Date;
  bitme_tarixi: Date | null;
  status: string;
  satish_tipi: string;
  valyuta: string;
  umumi_meblegh: number;
  endirim_meblegh: number;
  son_meblegh: number;
  musteri_id: string | null;
  musteri_ad: string | null;
  musteri_telefon: string | null;
  menecer_ad: string | null;
  filial_ad: string | null;
  yaradan_ad: string | null;
  tesdiq_eden_ad: string | null;
  satish_id: string | null;
  satish_nomre: string | null;
  qeyd: string | null;
  shertler: string | null;
  satir_say: number;
  /** İlk 5 məhsulun xülasəsi — siyahıda peek üçün. */
  ilk_mehsullar: TeklifLineSummary[];
  yaradildi: Date | null;
  yenilendi: Date | null;
};

export type TeklifFilter = {
  search?: string;
  status?: string[];
  from?: Date;
  to?: Date;
  /** Soft-delete filter */
  recordStatus?: "aktiv" | "silinmis" | "hamisi";
};

export type TeklifStats = {
  aktiv: number;
  cevrildi: number;
  redd: number;
  konversiya: number;
  bu_ay_meb: number;
  bu_ay_count: number;
};

export type TeklifStatusCounts = {
  hamisi: number;
  qaralama: number;
  gonderildi: number;
  qebul: number;
  satisa_cevrildi: number;
  redd: number;
  vaxti_bitdi: number;
};

export async function getTeklifStatusCounts(): Promise<TeklifStatusCounts> {
  return withTenant(async () => {
    const [hamisi, qaralama, gonderildi, qebul, cevrildi, redd, vaxti_bitdi] = await Promise.all([
      prisma.teklifler.count(),
      prisma.teklifler.count({ where: { status: "qaralama", satish_id: null } }),
      prisma.teklifler.count({ where: { status: "gonderildi", satish_id: null } }),
      prisma.teklifler.count({ where: { status: "qebul", satish_id: null } }),
      prisma.teklifler.count({ where: { satish_id: { not: null } } }),
      prisma.teklifler.count({ where: { status: "redd" } }),
      prisma.teklifler.count({ where: { status: "vaxti_bitdi" } }),
    ]);
    return {
      hamisi,
      qaralama,
      gonderildi,
      qebul,
      satisa_cevrildi: cevrildi,
      redd,
      vaxti_bitdi,
    };
  });
}

export async function getTeklifStats(): Promise<TeklifStats> {
  return withTenant(async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [aktiv, cevrildi, redd, bu_ay] = await Promise.all([
      prisma.teklifler.count({ where: { status: { in: ["qaralama", "gonderildi", "qebul"] } } }),
      prisma.teklifler.count({ where: { satish_id: { not: null } } }),
      prisma.teklifler.count({ where: { status: "redd" } }),
      prisma.teklifler.aggregate({
        where: { tarix: { gte: monthStart } },
        _sum: { son_meblegh: true },
        _count: { _all: true },
      }),
    ]);
    const total = aktiv + cevrildi + redd;
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return {
      aktiv,
      cevrildi,
      redd,
      konversiya: total > 0 ? Math.round((cevrildi / total) * 100) : 0,
      bu_ay_meb: Number(bu_ay._sum.son_meblegh ?? 0) * s,
      bu_ay_count: bu_ay._count._all,
    };
  });
}

export async function getTeklifler(
  filter: TeklifFilter,
  limit = 100
): Promise<{ items: TeklifListItem[]; total: number }> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    const rs = filter.recordStatus ?? "aktiv";
    if (rs === "aktiv") where.deleted_at = null;
    else if (rs === "silinmis") where.deleted_at = { not: null };
    if (filter.status?.length) where.status = { in: filter.status };
    if (filter.from || filter.to) {
      where.tarix = {};
      if (filter.from) where.tarix.gte = filter.from;
      if (filter.to) where.tarix.lte = filter.to;
    }
    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { nomre: { contains: q, mode: "insensitive" } },
        { musteri_ad: { contains: q, mode: "insensitive" } },
        { kontragentler: { ad: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.teklifler.findMany({
        where,
        orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
        take: limit,
        include: {
          kontragentler: { select: { ad: true, telefon: true } },
          istifadeciler_teklifler_menecer_idToistifadeciler: { select: { ad_soyad: true } },
          istifadeciler_teklifler_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
          istifadeciler_teklifler_tesdiq_eden_idToistifadeciler: { select: { ad_soyad: true } },
          filiallar: { select: { ad: true } },
          satis_sifarisleri: { select: { nomre: true } },
          _count: { select: { teklif_satirlari: true } },
          teklif_satirlari: {
            take: 5,
            orderBy: { id: "asc" },
            select: {
              sayi: true,
              qiymet: true,
              satir_meblegh: true,
              mehsul_ad: true,
              barkod: true,
              mehsullar: { select: { ad: true, kod: true } },
            },
          },
        },
      }),
      prisma.teklifler.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        nomre: t.nomre,
        tarix: t.tarix,
        bitme_tarixi: t.bitme_tarixi,
        status: t.status ?? "qaralama",
        satish_tipi: t.satish_tipi ?? "perakende",
        valyuta: t.valyuta ?? "AZN",
        umumi_meblegh: Number(t.umumi_meblegh ?? 0),
        endirim_meblegh: Number(t.endirim_meblegh ?? 0),
        son_meblegh: Number(t.son_meblegh ?? 0),
        musteri_id: t.musteri_id,
        musteri_ad: t.kontragentler?.ad ?? t.musteri_ad ?? null,
        musteri_telefon: t.kontragentler?.telefon ?? t.musteri_telefon ?? null,
        menecer_ad: t.istifadeciler_teklifler_menecer_idToistifadeciler?.ad_soyad ?? null,
        filial_ad: t.filiallar?.ad ?? null,
        yaradan_ad: t.istifadeciler_teklifler_yaradan_idToistifadeciler?.ad_soyad ?? null,
        tesdiq_eden_ad: t.istifadeciler_teklifler_tesdiq_eden_idToistifadeciler?.ad_soyad ?? null,
        satish_id: t.satish_id,
        satish_nomre: t.satis_sifarisleri?.nomre ?? null,
        qeyd: t.qeyd,
        shertler: t.shertler,
        satir_say: t._count.teklif_satirlari,
        ilk_mehsullar: t.teklif_satirlari.map((line) => ({
          ad: line.mehsullar?.ad ?? line.mehsul_ad ?? "—",
          kod: line.mehsullar?.kod ?? line.barkod ?? null,
          miqdar: Number(line.sayi),
          qiymet: Number(line.qiymet ?? 0),
          cemi: Number(line.satir_meblegh ?? 0),
        })),
        yaradildi: t.yaradildi,
        yenilendi: t.yenilendi,
      })),
      total,
    };
  });
}
