import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export type KreditRow = {
  id: string;
  /** Kredit qeydi id (kredit_satislari.id) — ödəniş qeyd etmək üçün */
  kredit_id: string | null;
  nomre: string;
  tarix: Date;
  status: string;
  /** UI status: "gozlenir" | "qismen" | "tamamlandi" | "redd" */
  qeyd_status: string;
  musteri_id: string | null;
  musteri_ad: string | null;
  musteri_telefon: string | null;
  bank: string | null;
  son_mebleg: number;
  odenilmis: number;
  qaliq: number;
  magaza_net: number;
  bank_komissiya: number;
  satici_ad: string | null;
  anbar_ad: string | null;
  filial_ad: string | null;
  satir_say: number;
  yaradildi: Date | null;
  yenilendi: Date | null;
  qeyd: string | null;
  son_odenis_tarix: Date | null;
  gecikme_gun: number;
};

export type KreditStats = {
  aktiv: number;
  toplam_borc: number;
  bu_ay_yeni: number;
  bu_ay_yeni_mebleg: number;
  gecikmis: number;
  gecikmis_borc: number;
};

export type MusteriBorc = {
  musteri_id: string;
  musteri_ad: string;
  musteri_telefon: string | null;
  borc: number;
  satislar_sayi: number;
  son_satis_tarix: Date;
  son_odenis_tarix: Date | null;
};

export async function getKreditStats(): Promise<KreditStats> {
  return withTenant(async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const KREDIT_NOVLER = ["nisye", "kredit", "kredit_qeyd"];
    const [aktiv, bu_ay] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: {
          odenis_nov: { in: KREDIT_NOVLER },
          status: { not: "legv" },
        },
        _sum: { son_mebleg: true, odenilmis: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: {
          odenis_nov: { in: KREDIT_NOVLER },
          tarix: { gte: monthStart },
          status: { not: "legv" },
        },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
    ]);

    const toplam_borc = Number(aktiv._sum.son_mebleg ?? 0) - Number(aktiv._sum.odenilmis ?? 0);

    // Calculate overdue (>30 days)
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 30);
    const gecikmis = await prisma.satis_sifarisleri.aggregate({
      where: {
        odenis_nov: { in: KREDIT_NOVLER },
        status: { not: "legv" },
        tarix: { lt: cutoff },
      },
      _sum: { son_mebleg: true, odenilmis: true },
      _count: { _all: true },
    });
    const gecikmis_borc = Number(gecikmis._sum.son_mebleg ?? 0) - Number(gecikmis._sum.odenilmis ?? 0);

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      aktiv: aktiv._count._all,
      toplam_borc: toplam_borc * s,
      bu_ay_yeni: bu_ay._count._all,
      bu_ay_yeni_mebleg: Number(bu_ay._sum.son_mebleg ?? 0) * s,
      gecikmis: gecikmis._count._all,
      gecikmis_borc: gecikmis_borc * s,
    };
  });
}

export async function getKreditSales(filter?: { search?: string; from?: Date; to?: Date }): Promise<KreditRow[]> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      odenis_nov: { in: ["nisye", "kredit", "kredit_qeyd"] },
    };
    if (filter?.from || filter?.to) {
      where.tarix = {};
      if (filter.from) where.tarix.gte = filter.from;
      if (filter.to) where.tarix.lte = filter.to;
    }
    if (filter?.search) {
      const q = filter.search.trim();
      where.OR = [
        { nomre: { contains: q, mode: "insensitive" } },
        { kontragentler: { ad: { contains: q, mode: "insensitive" } } },
        { kontragentler: { telefon: { contains: q } } },
      ];
    }

    const items = await prisma.satis_sifarisleri.findMany({
      where,
      orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
      take: 200,
      include: {
        kontragentler: { select: { ad: true, telefon: true } },
        istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler: { select: { ad_soyad: true } },
        anbarlar: { select: { ad: true } },
        filiallar: { select: { ad: true } },
        _count: { select: { satis_sifaris_satirlari: true } },
        kredit_satislari: {
          select: {
            id: true,
            bank: true,
            magaza_net: true,
            bank_komissiya: true,
            status: true,
            pul_alindi: true,
            pul_alinma_tarixi: true,
          },
        },
      },
    });

    const today = new Date();
    return items.map((s) => {
      const son_mebleg = Number(s.son_mebleg ?? 0);
      const odenilmis = Number(s.odenilmis ?? 0);
      const qaliq = son_mebleg - odenilmis;
      const tarix = s.tarix;
      const gecikme_gun =
        qaliq > 0 && tarix
          ? Math.max(0, Math.floor((today.getTime() - new Date(tarix).getTime()) / 86400000) - 30)
          : 0;
      const k = s.kredit_satislari;
      const magazaNet = Number(k?.magaza_net ?? son_mebleg);
      const bankKom = Number(k?.bank_komissiya ?? 0);
      // qeyd_status: bank ödəyibsə "tamamlandi" / "qismen", yoxsa "gozlenir"
      let qeydStatus = "gozlenir";
      if (k?.pul_alindi) qeydStatus = "tamamlandi";
      else if (k && Number(k.status ?? "") === 0 && odenilmis > 0) qeydStatus = "qismen";
      else if (k?.status === "qismen") qeydStatus = "qismen";
      else if (k?.status === "tamamlandi") qeydStatus = "tamamlandi";
      else if (k?.status === "redd") qeydStatus = "redd";
      else if (odenilmis > 0 && odenilmis < magazaNet) qeydStatus = "qismen";
      else if (odenilmis >= magazaNet && magazaNet > 0) qeydStatus = "tamamlandi";

      return {
        id: s.id,
        kredit_id: k?.id ?? null,
        nomre: s.nomre,
        tarix: s.tarix,
        status: s.status ?? "yeni",
        qeyd_status: qeydStatus,
        musteri_id: s.musteri_id,
        musteri_ad: s.kontragentler?.ad ?? null,
        musteri_telefon: s.kontragentler?.telefon ?? null,
        bank: k?.bank ?? null,
        son_mebleg,
        odenilmis,
        qaliq,
        magaza_net: magazaNet,
        bank_komissiya: bankKom,
        satici_ad: s.istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler?.ad_soyad ?? null,
        anbar_ad: s.anbarlar?.ad ?? null,
        filial_ad: s.filiallar?.ad ?? null,
        satir_say: s._count.satis_sifaris_satirlari,
        yaradildi: s.yaradildi,
        yenilendi: s.yenilendi,
        qeyd: s.qeyd,
        son_odenis_tarix: k?.pul_alinma_tarixi ?? null,
        gecikme_gun,
      };
    });
  });
}

// Alias for clarity in new API
export const getKreditList = getKreditSales;

export async function getKreditDetail(id: string) {
  return withTenant(async () => {
    const k = await prisma.kredit_satislari.findUnique({
      where: { id },
      include: {
        satis_sifarisleri: {
          include: {
            kontragentler: { select: { ad: true, telefon: true } },
            satis_sifaris_satirlari: {
              include: { mehsullar: { select: { ad: true, kod: true } } },
            },
          },
        },
        maliye_hesablari: { select: { ad: true } },
      },
    });
    return k;
  });
}

export async function getMusteriBorc(limit = 20): Promise<MusteriBorc[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      {
        musteri_id: string;
        musteri_ad: string;
        telefon: string | null;
        borc: number;
        satislar_sayi: number;
        son_satis_tarix: Date;
      }[]
    >`
      SELECT
        k.id::text                  AS musteri_id,
        k.ad                        AS musteri_ad,
        k.telefon                   AS telefon,
        COALESCE(SUM(s.son_mebleg - COALESCE(s.odenilmis, 0)), 0)::float AS borc,
        COUNT(s.id)::int            AS satislar_sayi,
        MAX(s.tarix)                AS son_satis_tarix
      FROM kontragentler k
      JOIN satis_sifarisleri s
        ON s.musteri_id = k.id
       AND s.sahibkar_id = k.sahibkar_id
       AND s.odenis_nov IN ('nisye', 'kredit', 'kredit_qeyd')
       AND COALESCE(s.status, '') NOT IN ('legv')
      WHERE k.sahibkar_id = ${sahibkarId}::uuid
      GROUP BY 1, 2, 3
      HAVING COALESCE(SUM(s.son_mebleg - COALESCE(s.odenilmis, 0)), 0) > 0
      ORDER BY borc DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      musteri_id: r.musteri_id,
      musteri_ad: r.musteri_ad,
      musteri_telefon: r.telefon,
      borc: Number(r.borc),
      satislar_sayi: Number(r.satislar_sayi),
      son_satis_tarix: new Date(r.son_satis_tarix),
      son_odenis_tarix: null,
    }));
  });
}
