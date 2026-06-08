"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { canViewCost } from "@/lib/auth/finance-permissions";

export type ProductContext = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  sekil_url: string | null;
  marka_ad: string | null;
  kateqoriya_ad: string | null;
  olcu_ad: string | null;
  satis_qiymeti: number;
  topdan_qiymet: number | null;
  endirimli_qiymet: number | null;
  /** Maya — yalnız icazə olduqda göstərilir */
  alish_qiymeti: number | null;
  can_view_cost: boolean;
  kritik_stok: number;
  zemanet_ay: number;
  aktiv: boolean;
  /** Cəmi bütün anbarlar üzrə */
  toplam_stok: number;
  /** Aktiv rezervlər */
  rezerv_miqdar: number;
  /** Satıla bilən = toplam - rezerv */
  satilabilen: number;
  /** Hər anbar üzrə bölgü */
  anbarlar: Array<{
    anbar_id: number;
    anbar_ad: string;
    miqdar: number;
    son_qiymet: number | null;
  }>;
  /** Seçilmiş anbarda stok (opts.anbar_id verilibsə) */
  selected_anbar?: { id: number; ad: string; miqdar: number } | null;
  /** Son satış tarixi və qiyməti */
  son_satis: { tarix: Date; qiymet: number } | null;
  /** Son alış tarixi və qiyməti */
  son_alish: { tarix: Date; qiymet: number } | null;
};

export async function getProductContext(opts: {
  mehsul_id: string;
  anbar_id?: number;
}): Promise<ProductContext | null> {
  if (!opts.mehsul_id) return null;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const showCost = await canViewCost();

    const m = await prisma.mehsullar.findFirst({
      where: { id: opts.mehsul_id, sahibkar_id: sahibkarId },
      select: {
        id: true, ad: true, kod: true, barkod: true, sekil_url: true,
        satis_qiymeti: true, alish_qiymeti: true, topdan_qiymeti: true,
        endirimli_qiymet: true,
        kritik_stok: true, zemanet_ay: true, aktiv: true,
        markalar: { select: { ad: true } },
        kateqoriyalar: { select: { ad: true } },
        olcu_vahidleri: { select: { qisa_ad: true, ad: true } },
      },
    });
    if (!m) return null;

    // Stok bölgüsü
    const stoks = await prisma.stok.findMany({
      where: { sahibkar_id: sahibkarId, mehsul_id: opts.mehsul_id },
      select: {
        miqdar: true, son_qiymet: true,
        anbarlar: { select: { id: true, ad: true } },
      },
    }).catch(() => []);

    const anbarlar = stoks
      .filter((s) => s.anbarlar)
      .map((s) => ({
        anbar_id: s.anbarlar!.id,
        anbar_ad: s.anbarlar!.ad,
        miqdar: Number(s.miqdar ?? 0),
        son_qiymet: s.son_qiymet != null ? Number(s.son_qiymet) : null,
      }));
    const toplam = anbarlar.reduce((sum, a) => sum + a.miqdar, 0);

    // Aktiv rezerv
    const rezervAgg = await prisma.stok_bron.aggregate({
      where: {
        sahibkar_id: sahibkarId,
        mehsul_id: opts.mehsul_id,
        status: "aktiv",
      },
      _sum: { sayi: true },
    }).catch(() => null);
    const rezerv = Number(rezervAgg?._sum?.sayi ?? 0);

    // Seçilmiş anbarda stok
    let selectedAnbar: { id: number; ad: string; miqdar: number } | null = null;
    if (opts.anbar_id) {
      const found = anbarlar.find((a) => a.anbar_id === opts.anbar_id);
      if (found) {
        selectedAnbar = { id: found.anbar_id, ad: found.anbar_ad, miqdar: found.miqdar };
      } else {
        const anb = await prisma.anbarlar.findFirst({
          where: { id: opts.anbar_id },
          select: { id: true, ad: true },
        }).catch(() => null);
        if (anb) selectedAnbar = { id: anb.id, ad: anb.ad, miqdar: 0 };
      }
    }

    // Son satış (satis_sifaris_satirlari → tarix)
    const sonSatisRow = await prisma.satis_sifaris_satirlari.findFirst({
      where: {
        sahibkar_id: sahibkarId,
        mehsul_id: opts.mehsul_id,
        satis_sifarisleri: {
          status: { not: "legv" },
          qaralama: { not: true },
        },
      },
      orderBy: { satis_sifarisleri: { tarix: "desc" } },
      select: {
        vahid_qiymet: true,
        satis_sifarisleri: { select: { tarix: true } },
      },
    }).catch(() => null);

    // Son alış
    const sonAlisRow = await prisma.alis_sifaris_satirlari.findFirst({
      where: {
        sahibkar_id: sahibkarId,
        mehsul_id: opts.mehsul_id,
        alis_sifarisleri: { status: { not: "legv" } },
      },
      orderBy: { alis_sifarisleri: { tarix: "desc" } },
      select: {
        vahid_qiymet: true,
        alis_sifarisleri: { select: { tarix: true } },
      },
    }).catch(() => null);

    return {
      id: m.id,
      ad: m.ad,
      kod: m.kod,
      barkod: m.barkod,
      sekil_url: m.sekil_url,
      marka_ad: m.markalar?.ad ?? null,
      kateqoriya_ad: m.kateqoriyalar?.ad ?? null,
      olcu_ad: m.olcu_vahidleri?.qisa_ad ?? m.olcu_vahidleri?.ad ?? null,
      satis_qiymeti: Number(m.satis_qiymeti ?? 0),
      topdan_qiymet: Number(m.topdan_qiymeti ?? 0) || null,
      endirimli_qiymet: m.endirimli_qiymet != null ? Number(m.endirimli_qiymet) : null,
      alish_qiymeti: showCost ? Number(m.alish_qiymeti ?? 0) : null,
      can_view_cost: showCost,
      kritik_stok: Number(m.kritik_stok ?? 0),
      zemanet_ay: Number(m.zemanet_ay ?? 0),
      aktiv: m.aktiv ?? true,
      toplam_stok: toplam,
      rezerv_miqdar: rezerv,
      satilabilen: Math.max(0, toplam - rezerv),
      anbarlar,
      selected_anbar: selectedAnbar,
      son_satis: sonSatisRow?.satis_sifarisleri?.tarix
        ? { tarix: sonSatisRow.satis_sifarisleri.tarix, qiymet: Number(sonSatisRow.vahid_qiymet) }
        : null,
      son_alish: sonAlisRow?.alis_sifarisleri?.tarix
        ? { tarix: sonAlisRow.alis_sifarisleri.tarix, qiymet: Number(sonAlisRow.vahid_qiymet) }
        : null,
    };
  });
}
