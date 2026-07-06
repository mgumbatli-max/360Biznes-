import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

// İSTEHSAL / BOM (resept-əsaslı istehsal). Resept ayarlar-da JSON saxlanılır (schema-migrasiyasız):
//   qrup="istehsal", acar="resept:<hazir_mehsul_id>", deyer=JSON [{mehsul_id, miqdar}].
// produceProduct: komponent stoku düşür, istehsal-maya hesablanır, hazır məhsul stoka əlavə olunur.
export const ISTEHSAL_QRUP = "istehsal";
export const RESEPT_ACAR_PREFIX = "resept:";

export type ReceptKomponent = { mehsul_id: string; miqdar: number };

export type ReceptKomponentDetal = {
  mehsul_id: string;
  ad: string;
  miqdar: number;       // 1 vahid hazır məhsul üçün lazım
  maya: number;         // komponentin vahid mayası
  setir_maya: number;   // miqdar × maya
  cari_stok: number;    // komponentin cəmi cari stoku (bütün anbarlar)
};

export type Recept = {
  hazir_mehsul_id: string;
  hazir_ad: string;
  komponentler: ReceptKomponentDetal[];
  vahid_maya: number;   // 1 vahid hazır məhsulun istehsal-mayası (komponent cəmi)
};

/** JSON reseptini oxu + komponentləri cari ad/maya/stok ilə zənginləşdir. */
export async function getRecipe(hazirMehsulId: string): Promise<Recept | null> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const hazir = await prisma.mehsullar.findFirst({ where: { id: hazirMehsulId, sahibkar_id: sahibkarId }, select: { ad: true } });
    if (!hazir) return null;
    const row = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: ISTEHSAL_QRUP, acar: RESEPT_ACAR_PREFIX + hazirMehsulId },
      select: { deyer: true },
    });
    let raw: ReceptKomponent[] = [];
    if (row?.deyer) { try { raw = JSON.parse(row.deyer); } catch { raw = []; } }
    if (!Array.isArray(raw) || raw.length === 0) {
      return { hazir_mehsul_id: hazirMehsulId, hazir_ad: hazir.ad, komponentler: [], vahid_maya: 0 };
    }

    const ids = raw.map((r) => r.mehsul_id);
    const [prods, stoklar] = await Promise.all([
      prisma.mehsullar.findMany({ where: { id: { in: ids }, sahibkar_id: sahibkarId }, select: { id: true, ad: true, alish_qiymeti: true } }),
      prisma.stok.groupBy({ by: ["mehsul_id"], where: { sahibkar_id: sahibkarId, mehsul_id: { in: ids } }, _sum: { miqdar: true } }),
    ]);
    const prodMap = new Map(prods.map((p) => [p.id, p]));
    const stokMap = new Map(stoklar.map((s) => [s.mehsul_id, Number(s._sum.miqdar ?? 0)]));

    const komponentler: ReceptKomponentDetal[] = raw
      .filter((r) => prodMap.has(r.mehsul_id))
      .map((r) => {
        const p = prodMap.get(r.mehsul_id)!;
        const maya = Number(p.alish_qiymeti ?? 0);
        const miqdar = Number(r.miqdar) || 0;
        return { mehsul_id: r.mehsul_id, ad: p.ad, miqdar, maya, setir_maya: Math.round(miqdar * maya * 100) / 100, cari_stok: stokMap.get(r.mehsul_id) ?? 0 };
      });
    const vahidMaya = Math.round(komponentler.reduce((s, k) => s + k.setir_maya, 0) * 100) / 100;
    return { hazir_mehsul_id: hazirMehsulId, hazir_ad: hazir.ad, komponentler, vahid_maya: vahidMaya };
  });
}

/** Hazır məhsulu OLAN (resepti təyin olunmuş) məhsulların id-ləri. */
export async function getProductsWithRecipe(): Promise<string[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: ISTEHSAL_QRUP, acar: { startsWith: RESEPT_ACAR_PREFIX } },
      select: { acar: true },
    });
    return rows.map((r) => r.acar.slice(RESEPT_ACAR_PREFIX.length));
  });
}

// ============================================================
// İSTEHSAL TARİXÇƏSİ + XÜLASƏ (ledger: nov="medaxil" ref_nov="istehsal")
// ============================================================

export type IstehsalTarixce = {
  id: string;
  tarix: Date | null;
  mehsul_ad: string;
  anbar_ad: string | null;
  miqdar: number;
  vahid_maya: number;
  toplam_maya: number;
  edilen_ad: string | null;
};

export type IstehsalXulase = {
  bu_ay_say: number;      // istehsal əməliyyatı sayı
  bu_ay_miqdar: number;   // istehsal edilmiş ümumi ədəd
  bu_ay_maya: number;     // ümumi istehsal-maya (₼)
  tarixce: IstehsalTarixce[];
};

/** Son N istehsal əməliyyatı + bu ay xülasəsi. */
export async function getProductionHistory(limit = 50): Promise<IstehsalXulase> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const rows = await prisma.anbar_hereketleri.findMany({
      where: { sahibkar_id: sahibkarId, ref_nov: "istehsal", nov: "medaxil" },
      orderBy: { yaradildi: "desc" },
      take: limit,
      select: {
        id: true, miqdar: true, qiymet: true, yaradildi: true,
        mehsullar: { select: { ad: true } },
        anbarlar: { select: { ad: true } },
        istifadeciler: { select: { ad_soyad: true } },
      },
    });
    const tarixce: IstehsalTarixce[] = rows.map((r) => {
      const miqdar = Number(r.miqdar);
      const vahidMaya = Number(r.qiymet ?? 0);
      return {
        id: r.id, tarix: r.yaradildi,
        mehsul_ad: r.mehsullar?.ad ?? "—",
        anbar_ad: r.anbarlar?.ad ?? null,
        miqdar, vahid_maya: vahidMaya,
        toplam_maya: Math.round(miqdar * vahidMaya * 100) / 100,
        edilen_ad: r.istifadeciler?.ad_soyad ?? null,
      };
    });

    // Bu ay xülasəsi (bütün ay, limitdən asılı olmayaraq ayrıca aqreqasiya)
    const ayRows = await prisma.anbar_hereketleri.findMany({
      where: { sahibkar_id: sahibkarId, ref_nov: "istehsal", nov: "medaxil", yaradildi: { gte: monthStart } },
      select: { miqdar: true, qiymet: true },
    });
    let ayMiqdar = 0, ayMaya = 0;
    for (const r of ayRows) { const m = Number(r.miqdar); ayMiqdar += m; ayMaya += m * Number(r.qiymet ?? 0); }

    return {
      bu_ay_say: ayRows.length,
      bu_ay_miqdar: Math.round(ayMiqdar * 100) / 100,
      bu_ay_maya: Math.round(ayMaya * 100) / 100,
      tarixce,
    };
  });
}
