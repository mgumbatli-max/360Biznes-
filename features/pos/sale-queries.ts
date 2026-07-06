import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma, prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { searchProductIdsSpaceInsensitive } from "@/lib/db/space-insensitive-search";

/** Məhsulun başqa anbarda mövcudluğu — satıcı bilir ki, "buralarda da var". */
export type OtherAnbarStock = {
  anbar_id: number;
  anbar_ad: string;
  miqdar: number;
};

export type ProductRow = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  satis_qiymeti: number;
  alish_qiymeti: number;
  min_satis_qiymeti: number;
  topdan_qiymeti: number;
  partnyor_qiymeti: number;
  vip_qiymeti: number;
  /** Seçilmiş anbarda olan stok. Anbar yoxdursa, ümumi stok. */
  stok_miqdari: number;
  /** Digər anbarlardakı stok — satıcının xəbərdar olması üçün. */
  diger_anbarlarda: OtherAnbarStock[];
};

export type CustomerRow = {
  id: string;
  ad: string;
  telefon: string | null;
  email: string | null;
  borc: number;
};

function mapProduct(
  m: {
    id: string;
    ad: string;
    kod: string | null;
    barkod: string | null;
    satis_qiymeti: { toString(): string } | null;
    alish_qiymeti: { toString(): string } | null;
    min_satis_qiymeti: { toString(): string } | null;
    topdan_qiymeti: { toString(): string } | null;
    partnyor_qiymeti: { toString(): string } | null;
    vip_qiymeti: { toString(): string } | null;
    stok: { miqdar: { toString(): string } | null; anbar_id: number | null }[];
  },
  anbarId: number | undefined,
  anbarAdMap: Map<number, string>,
): ProductRow {
  let inSelected = 0;
  const others: OtherAnbarStock[] = [];
  for (const s of m.stok) {
    const q = Number(s.miqdar ?? 0);
    if (q <= 0 || s.anbar_id == null) continue;
    if (anbarId != null && s.anbar_id === anbarId) {
      inSelected += q;
    } else {
      others.push({
        anbar_id: s.anbar_id,
        anbar_ad: anbarAdMap.get(s.anbar_id) ?? `Anbar #${s.anbar_id}`,
        miqdar: q,
      });
    }
  }
  // Anbar seçilməyibsə, hamısı "stok_miqdari"-yə cəm olur, "digər" boşalır
  if (anbarId == null) {
    inSelected = others.reduce((s, o) => s + o.miqdar, 0);
    others.length = 0;
  }
  // Çoxdan az ardıcıllığı
  others.sort((a, b) => b.miqdar - a.miqdar);
  return {
    id: m.id,
    ad: m.ad,
    kod: m.kod,
    barkod: m.barkod,
    satis_qiymeti: Number(m.satis_qiymeti ?? 0),
    alish_qiymeti: Number(m.alish_qiymeti ?? 0),
    min_satis_qiymeti: Number(m.min_satis_qiymeti ?? 0),
    topdan_qiymeti: Number(m.topdan_qiymeti ?? 0),
    partnyor_qiymeti: Number(m.partnyor_qiymeti ?? 0),
    vip_qiymeti: Number(m.vip_qiymeti ?? 0),
    stok_miqdari: inSelected,
    diger_anbarlarda: others,
  };
}

/** Anbar id → ad map — bir dəfə oxunur, mapProduct istifadə edir. */
async function getAnbarAdMap(): Promise<Map<number, string>> {
  const { sahibkarId } = requireTenant();
  const rows = await prisma.anbarlar.findMany({
    where: { sahibkar_id: sahibkarId },
    select: { id: true, ad: true },
  });
  return new Map(rows.map((r) => [r.id, r.ad]));
}

export async function searchProducts(q: string, anbarId?: number, limit = 12): Promise<ProductRow[]> {
  const trimmed = q.trim();
  return withTenant(async () => {
    // Boş sorğuda ən son əlavə edilmiş aktiv məhsullardan ilk N qaytar — fokuslayanda
    // dropdown-da ad göstərmək üçün.
    const matchedIds =
      trimmed.length > 0
        ? await searchProductIdsSpaceInsensitive(trimmed, { limit: 200, activeOnly: true })
        : [];
    const rows = await prisma.mehsullar.findMany({
      where: {
        aktiv: true,
        ...(trimmed.length > 0
          ? {
              OR: [
                ...(matchedIds.length > 0 ? [{ id: { in: matchedIds } }] : []),
                { barkod: trimmed },
                { mehsul_barkodlar: { some: { barkod: trimmed } } },
              ],
            }
          : {}),
      },
      // Daha çox tut — sonra prioritetlə yenidən sırala və limit-ə endir
      take: limit * 4,
      select: {
        id: true,
        ad: true,
        kod: true,
        barkod: true,
        satis_qiymeti: true,
        alish_qiymeti: true,
        min_satis_qiymeti: true,
        topdan_qiymeti: true,
        partnyor_qiymeti: true,
        vip_qiymeti: true,
        stok: { select: { miqdar: true, anbar_id: true } },
      },
    });
    const anbarAdMap = await getAnbarAdMap();
    const mapped = rows.map((r) => mapProduct(r, anbarId, anbarAdMap));
    // Prioritet: seçilmiş anbarda stok > 0 olanlar, sonra digər anbarda stok olanlar, sonra heç yerdə olmayanlar
    mapped.sort((a, b) => {
      const aHasSelected = a.stok_miqdari > 0;
      const bHasSelected = b.stok_miqdari > 0;
      if (aHasSelected !== bHasSelected) return aHasSelected ? -1 : 1;
      const aHasOther = a.diger_anbarlarda.length > 0;
      const bHasOther = b.diger_anbarlarda.length > 0;
      if (aHasOther !== bHasOther) return aHasOther ? -1 : 1;
      return a.ad.localeCompare(b.ad, "az");
    });
    return mapped.slice(0, limit);
  });
}

export async function lookupByBarcode(barcode: string, anbarId?: number): Promise<ProductRow | null> {
  if (!barcode) return null;
  return withTenant(async () => {
    const row = await prisma.mehsullar.findFirst({
      where: {
        aktiv: true,
        OR: [{ barkod: barcode }, { mehsul_barkodlar: { some: { barkod: barcode } } }],
      },
      select: {
        id: true,
        ad: true,
        kod: true,
        barkod: true,
        satis_qiymeti: true,
        alish_qiymeti: true,
        min_satis_qiymeti: true,
        topdan_qiymeti: true,
        partnyor_qiymeti: true,
        vip_qiymeti: true,
        stok: { select: { miqdar: true, anbar_id: true } },
      },
    });
    if (!row) return null;
    const anbarAdMap = await getAnbarAdMap();
    return mapProduct(row, anbarId, anbarAdMap);
  });
}

export async function searchCustomers(q: string, limit = 10): Promise<CustomerRow[]> {
  const query = q?.trim() ?? "";
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.kontragentler.findMany({
      where: {
        aktiv: true,
        nov: { in: ["musteri", "her_ikisi"] },
        ...(query.length > 0
          ? {
              OR: [
                { ad: { contains: query, mode: "insensitive" } },
                { telefon: { contains: query } },
                { email: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      take: limit,
      orderBy: { ad: "asc" },
      select: { id: true, ad: true, telefon: true, email: true, borc: true, alacaq: true },
    });
    if (rows.length === 0) return [];

    // Faktiki açıq nisyə satışlardan da borcu yoxla — `alacaq` field sinxron
    // olmasa belə düzgün dəyər qaytarsın.
    const ids = rows.map((r) => r.id);
    const openAgg = await prisma.$queryRaw<
      { musteri_id: string; total: number | string | null }[]
    >`
      SELECT musteri_id::text AS musteri_id,
             COALESCE(SUM(son_mebleg - COALESCE(odenilmis, 0)), 0)::float AS total
        FROM satis_sifarisleri
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND musteri_id = ANY(${ids}::uuid[])
         AND status <> 'legv'
         AND COALESCE(qaralama, false) = false
         AND odenis_nov IN ('nisye', 'borc')
         AND son_mebleg - COALESCE(odenilmis, 0) > 0
       GROUP BY musteri_id
    `;
    const openMap = new Map(openAgg.map((o) => [o.musteri_id, Number(o.total ?? 0)]));

    return rows.map((r) => {
      const alacaq = Number(r.alacaq ?? 0);
      const legacyBorc = Math.max(0, Number(r.borc ?? 0));
      const openFromSales = openMap.get(r.id) ?? 0;
      return {
        id: r.id,
        ad: r.ad,
        telefon: r.telefon,
        email: r.email,
        borc: Math.max(alacaq, legacyBorc, openFromSales),
      };
    });
  });
}

export type SalespersonOption = { id: string; ad_soyad: string };

export async function getSalespersonOptions(): Promise<SalespersonOption[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    // QA-perf: POS satıcı dropdown-u reference-data (nadir dəyişir) → tenant-safe cache 120s.
    return unstable_cache(
      () => prismaUnscoped.istifadeciler.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        orderBy: { ad_soyad: "asc" },
        select: { id: true, ad_soyad: true },
      }),
      ["pos-salesperson-opt", sahibkarId],
      { revalidate: 120, tags: [`ref:${sahibkarId}:istifadeci`] },
    )();
  });
}

/**
 * POS üçün satılabilən bütün aktiv anbarları qaytarır (dropdown üçün).
 * Defekt/karantın/transit istisna; stoku olan ən yuxarıda.
 */
export async function getPosAnbarOptions(filialId?: number | null): Promise<Array<{ id: number; ad: string; total: number }>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<Array<{ id: number; ad: string; total: number }>>`
      SELECT a.id, a.ad, COALESCE(SUM(s.miqdar), 0)::float AS total
      FROM anbarlar a
      LEFT JOIN stok s ON s.anbar_id = a.id
      WHERE a.sahibkar_id = ${sahibkarId}::uuid
        AND a.aktiv = true
        AND a.nov IN ('standart', 'servis')
        ${filialId ? Prisma.sql`AND a.filial_id = ${filialId}` : Prisma.sql``}
      GROUP BY a.id, a.ad
      ORDER BY total DESC, a.id ASC
    `;
    // Əgər filial-da heç bir anbar yoxdursa, bütün sahibkar üçün qaytar
    if (rows.length === 0 && filialId) {
      const all = await prisma.$queryRaw<Array<{ id: number; ad: string; total: number }>>`
        SELECT a.id, a.ad, COALESCE(SUM(s.miqdar), 0)::float AS total
        FROM anbarlar a
        LEFT JOIN stok s ON s.anbar_id = a.id
        WHERE a.sahibkar_id = ${sahibkarId}::uuid
          AND a.aktiv = true
          AND a.nov IN ('standart', 'servis')
        GROUP BY a.id, a.ad
        ORDER BY total DESC, a.id ASC
      `;
      return all;
    }
    return rows;
  });
}

export async function getDefaultAnbar(filialId?: number | null): Promise<{ id: number; ad: string } | null> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    // 1) Filial üçün ƏN ÇOX STOKU OLAN standart/servis anbar.
    //    Əgər filialdakı bütün anbarlar boş və başqa filialda stok varsa,
    //    sahibkar səviyyəsində ən çox stoklu anbarı götürürük — POS-da boş stok
    //    göstərməkdənsə, mövcud stoklu anbar daha faydalıdır.
    if (filialId) {
      const rows = await prisma.$queryRaw<Array<{ id: number; ad: string; total: number }>>`
        SELECT a.id, a.ad, COALESCE(SUM(s.miqdar), 0)::float AS total
        FROM anbarlar a
        LEFT JOIN stok s ON s.anbar_id = a.id
        WHERE a.sahibkar_id = ${sahibkarId}::uuid
          AND a.aktiv = true
          AND a.filial_id = ${filialId}
          AND a.nov IN ('standart', 'servis')
        GROUP BY a.id, a.ad
        ORDER BY total DESC, a.id ASC
        LIMIT 1
      `;
      // Yalnız stoku > 0 olarsa qaytar; yoxsa fallback edək
      if (rows.length > 0 && Number(rows[0].total) > 0) {
        return { id: rows[0].id, ad: rows[0].ad };
      }
      // Filialda stoklu anbar yoxdur → sahibkar səviyyəsində baxırıq.
      // Lakin bu filial-da bir anbar varsa, default seçim hələ də onun olsun
      // (kassa açıldığı filiala məntiqi uyğundur). Yalnız stoku olan başqa filial
      // varsa onu tövsiyə kimi qaytarırıq.
    }

    // 2) Filial üçün anbar yoxdur → SAHİBKAR-da ən çox stoku olan standart anbar
    const rows = await prisma.$queryRaw<Array<{ id: number; ad: string; total: number }>>`
      SELECT a.id, a.ad, COALESCE(SUM(s.miqdar), 0)::float AS total
      FROM anbarlar a
      LEFT JOIN stok s ON s.anbar_id = a.id
      WHERE a.sahibkar_id = ${sahibkarId}::uuid
        AND a.aktiv = true
        AND a.nov IN ('standart', 'servis')
      GROUP BY a.id, a.ad
      ORDER BY total DESC, a.id ASC
      LIMIT 1
    `;
    if (rows.length > 0) return { id: rows[0].id, ad: rows[0].ad };

    // 3) Sahibkar-da heç bir standart anbar yoxdur — ilk aktiv anbarı qaytar
    const r = await prisma.anbarlar.findFirst({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      orderBy: { id: "asc" },
      select: { id: true, ad: true },
    });
    return r;
  });
}
