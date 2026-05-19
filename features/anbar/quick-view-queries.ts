import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type QuickViewServis = {
  id: string;
  nomre: string;
  tarix: Date | null;
  musteri_ad: string;
  problem: string;
  status: string;
  zemanet_var: boolean;
  netice: string | null;
};

export type QuickViewData = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  sekil_url: string | null;
  aktiv: boolean;
  marka_ad: string | null;
  kateqoriya_ad: string | null;
  vahid: string | null;
  alish_qiymeti: number;
  satis_qiymeti: number;
  topdan_qiymeti: number;
  partnyor_qiymeti: number;
  vip_qiymeti: number;
  endirimli_qiymet: number | null;
  cem_stok: number;
  anbarlar: Array<{ anbar_id: number; anbar_ad: string; miqdar: number }>;
  son_satis: { tarix: Date; nomre: string; musteri: string | null; qiymet: number; miqdar: number } | null;
  son_alis: { tarix: Date; nomre: string; techizatci: string | null; qiymet: number; miqdar: number } | null;
  servis_sayi: number;
  servis_aktiv: number;
  servis_qeydleri: QuickViewServis[];
};

export async function getQuickView(mehsul_id: string): Promise<QuickViewData | null> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const [m, stoks, lastSale, lastPurchase, servisList, servisCount] = await Promise.all([
      prisma.mehsullar.findUnique({
        where: { id: mehsul_id },
        include: {
          kateqoriyalar: { select: { ad: true } },
          markalar: { select: { ad: true } },
          olcu_vahidleri: { select: { ad: true, qisa_ad: true } },
        },
      }),
      prisma.$queryRaw<{ anbar_id: number; anbar_ad: string; miqdar: number }[]>`
        SELECT a.id AS anbar_id, a.ad AS anbar_ad, COALESCE(s.miqdar, 0)::float AS miqdar
          FROM anbarlar a
          LEFT JOIN stok s ON s.anbar_id = a.id AND s.mehsul_id = ${mehsul_id}::uuid
         WHERE a.sahibkar_id = ${sahibkarId}::uuid AND a.aktiv = TRUE
         ORDER BY a.ad
      `,
      prisma.$queryRaw<{ tarix: Date; nomre: string; musteri: string | null; qiymet: number; miqdar: number }[]>`
        SELECT ss.tarix, ss.nomre,
               k.ad AS musteri,
               sls.vahid_qiymet::float AS qiymet,
               sls.miqdar::float AS miqdar
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          LEFT JOIN kontragentler k ON k.id = ss.musteri_id
         WHERE sls.mehsul_id = ${mehsul_id}::uuid
           AND sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.status != 'legv'
         ORDER BY ss.tarix DESC
         LIMIT 1
      `,
      prisma.$queryRaw<{ tarix: Date; nomre: string; techizatci: string | null; qiymet: number; miqdar: number }[]>`
        SELECT al.tarix, al.nomre,
               k.ad AS techizatci,
               als.vahid_qiymet::float AS qiymet,
               als.miqdar::float AS miqdar
          FROM alis_sifaris_satirlari als
          JOIN alis_sifarisleri al ON al.id = als.sifaris_id
          LEFT JOIN kontragentler k ON k.id = al.techiazatci_id
         WHERE als.mehsul_id = ${mehsul_id}::uuid
           AND als.sahibkar_id = ${sahibkarId}::uuid
         ORDER BY al.tarix DESC
         LIMIT 1
      `,
      prisma.servis_qeydleri.findMany({
        where: { mehsul_id },
        orderBy: { yaradildi: "desc" },
        take: 5,
        select: {
          id: true,
          nomre: true,
          yaradildi: true,
          musteri_ad: true,
          problem_tesviri: true,
          status: true,
          zemanet_var: true,
          netice_aciqlamasi: true,
        },
      }),
      prisma.servis_qeydleri.groupBy({
        by: ["status"],
        where: { mehsul_id },
        _count: { _all: true },
      }),
    ]);

    if (!m) return null;

    return {
      id: m.id,
      ad: m.ad,
      kod: m.kod,
      barkod: m.barkod,
      sekil_url: m.sekil_url ?? null,
      aktiv: m.aktiv ?? false,
      marka_ad: m.markalar?.ad ?? null,
      kateqoriya_ad: m.kateqoriyalar?.ad ?? null,
      vahid: m.olcu_vahidleri?.qisa_ad ?? m.olcu_vahidleri?.ad ?? null,
      alish_qiymeti: Number(m.alish_qiymeti ?? 0),
      satis_qiymeti: Number(m.satis_qiymeti ?? 0),
      topdan_qiymeti: Number(m.topdan_qiymeti ?? 0),
      partnyor_qiymeti: Number(m.partnyor_qiymeti ?? 0),
      vip_qiymeti: Number(m.vip_qiymeti ?? 0),
      endirimli_qiymet: m.endirimli_qiymet ? Number(m.endirimli_qiymet) : null,
      cem_stok: stoks.reduce((s, r) => s + Number(r.miqdar), 0),
      anbarlar: stoks.map((r) => ({ ...r, miqdar: Number(r.miqdar) })),
      son_satis: lastSale[0] ?? null,
      son_alis: lastPurchase[0] ?? null,
      servis_sayi: servisCount.reduce((s, g) => s + g._count._all, 0),
      servis_aktiv: servisCount
        .filter((g) => !["qaytarildi", "musteriye_tehvil"].includes(g.status))
        .reduce((s, g) => s + g._count._all, 0),
      servis_qeydleri: servisList.map((s) => ({
        id: s.id,
        nomre: s.nomre,
        tarix: s.yaradildi,
        musteri_ad: s.musteri_ad,
        problem: s.problem_tesviri,
        status: s.status,
        zemanet_var: s.zemanet_var,
        netice: s.netice_aciqlamasi,
      })),
    };
  });
}
