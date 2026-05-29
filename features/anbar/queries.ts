import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { searchProductIdsSpaceInsensitive } from "@/lib/db/space-insensitive-search";
import { getStealthState } from "@/lib/stealth/server";

export type AnbarKpis = {
  toplam_mehsul: number;
  toplam_stok_vahid: number;
  toplam_stok_deyer: number;
  zero_stok: number;
  low_stok: number;
  rezerv_vahid: number;
  barkodsuz: number;
  mayasiz: number;
  sekilsiz: number;
  qiymetsiz: number;
};

/**
 * Compute warehouse KPIs in a single pass per concern. Avoids fragile
 * audit-log lookups; "missing image" is intentionally not surfaced here
 * because the legacy schema doesn't carry a direct image URL on `mehsullar`.
 */
export type AnbarValueKpis = {
  satis_deyeri: number;
  maya_deyeri: number;
  potensial_menfeet: number;
  satilmayan_60: number;
  olu_stok: number;
  bron_aktiv: number;
};

export async function getAnbarValueKpis(): Promise<AnbarValueKpis> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [vals, satilmayan, olu, bron] = await Promise.all([
      prisma.$queryRaw<{ satis_deyeri: number; maya_deyeri: number }[]>`
        SELECT
          COALESCE(SUM(s.miqdar * COALESCE(m.satis_qiymeti, 0)), 0)::float AS satis_deyeri,
          COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0)::float AS maya_deyeri
          FROM stok s
          JOIN mehsullar m ON m.id = s.mehsul_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(DISTINCT m.id)::bigint AS c
          FROM mehsullar m
          LEFT JOIN stok s ON s.mehsul_id = m.id AND s.sahibkar_id = m.sahibkar_id
         WHERE m.sahibkar_id = ${sahibkarId}::uuid
           AND m.aktiv = TRUE
           AND COALESCE(s.miqdar,0) > 0
           AND (m.son_satis_de IS NULL OR m.son_satis_de < NOW() - INTERVAL '60 days')
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(DISTINCT m.id)::bigint AS c
          FROM mehsullar m
          LEFT JOIN stok s ON s.mehsul_id = m.id AND s.sahibkar_id = m.sahibkar_id
         WHERE m.sahibkar_id = ${sahibkarId}::uuid
           AND m.aktiv = TRUE
           AND COALESCE(s.miqdar,0) > 0
           AND (m.son_satis_de IS NULL OR m.son_satis_de < NOW() - INTERVAL '90 days')
      `,
      prisma.stok_bron.count({ where: { status: "aktiv" } }),
    ]);
    const v = vals[0] ?? { satis_deyeri: 0, maya_deyeri: 0 };
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return {
      satis_deyeri: Number(v.satis_deyeri) * s,
      maya_deyeri: Number(v.maya_deyeri) * s,
      potensial_menfeet: (Number(v.satis_deyeri) - Number(v.maya_deyeri)) * s,
      satilmayan_60: Number(satilmayan[0]?.c ?? 0),
      olu_stok: Number(olu[0]?.c ?? 0),
      bron_aktiv: bron,
    };
  });
}

export type AnbarByWarehouse = {
  id: number;
  ad: string;
  mehsul_say: number;
  umumi_miqdar: number;
  satis_deyeri: number;
};

export async function getAnbarByWarehouse(): Promise<AnbarByWarehouse[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      { id: number; ad: string; mehsul_say: bigint; umumi_miqdar: number; satis_deyeri: number }[]
    >`
      SELECT a.id, a.ad,
             COUNT(DISTINCT s.mehsul_id)::bigint AS mehsul_say,
             COALESCE(SUM(s.miqdar), 0)::float AS umumi_miqdar,
             COALESCE(SUM(s.miqdar * COALESCE(m.satis_qiymeti, 0)), 0)::float AS satis_deyeri
        FROM anbarlar a
        LEFT JOIN stok s ON s.anbar_id = a.id AND s.sahibkar_id = a.sahibkar_id
        LEFT JOIN mehsullar m ON m.id = s.mehsul_id
       WHERE a.sahibkar_id = ${sahibkarId}::uuid AND COALESCE(a.aktiv, TRUE) = TRUE
       GROUP BY a.id, a.ad
       ORDER BY satis_deyeri DESC
       LIMIT 8
    `;
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      mehsul_say: Number(r.mehsul_say),
      umumi_miqdar: Number(r.umumi_miqdar),
      satis_deyeri: Number(r.satis_deyeri),
    }));
  });
}

export type AnbarByBrand = { id: number; ad: string; mehsul_say: number; deyer: number };

export async function getAnbarByBrand(): Promise<AnbarByBrand[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      { id: number; ad: string; mehsul_say: bigint; deyer: number }[]
    >`
      SELECT br.id, br.ad,
             COUNT(DISTINCT m.id)::bigint AS mehsul_say,
             COALESCE(SUM(s.miqdar * COALESCE(m.satis_qiymeti, 0)), 0)::float AS deyer
        FROM markalar br
        JOIN mehsullar m ON m.marka_id = br.id
        LEFT JOIN stok s ON s.mehsul_id = m.id AND s.sahibkar_id = m.sahibkar_id
       WHERE br.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
       GROUP BY br.id, br.ad
       ORDER BY deyer DESC
       LIMIT 10
    `;
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      mehsul_say: Number(r.mehsul_say),
      deyer: Number(r.deyer),
    }));
  });
}

export async function getAnbarKpis(): Promise<AnbarKpis> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const [productsCount, stockTotals, problems, rezervAgg] = await Promise.all([
      prisma.mehsullar.count({ where: { aktiv: true } }),
      prisma.$queryRaw<{ total_qty: number; total_value: number }[]>`
        SELECT COALESCE(SUM(s.miqdar), 0)::float AS total_qty,
               COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0)::float AS total_value
          FROM stok s
          JOIN mehsullar m ON m.id = s.mehsul_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
      `,
      prisma.$queryRaw<{ zero_stok: bigint; low_stok: bigint; barkodsuz: bigint; mayasiz: bigint; sekilsiz: bigint; qiymetsiz: bigint }[]>`
        WITH stok_per_mehsul AS (
          SELECT m.id, COALESCE(SUM(s.miqdar), 0) AS qty
            FROM mehsullar m
            LEFT JOIN stok s ON s.mehsul_id = m.id AND s.sahibkar_id = m.sahibkar_id
           WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
           GROUP BY m.id
        )
        SELECT
          COUNT(*) FILTER (WHERE qty = 0) AS zero_stok,
          COUNT(*) FILTER (
            WHERE qty > 0
              AND EXISTS (
                SELECT 1 FROM mehsullar mm
                 WHERE mm.id = spm.id
                   AND mm.kritik_stok IS NOT NULL
                   AND mm.kritik_stok > 0
                   AND spm.qty <= mm.kritik_stok
              )
          ) AS low_stok,
          (SELECT COUNT(*)::bigint FROM mehsullar
            WHERE sahibkar_id = ${sahibkarId}::uuid AND aktiv = TRUE
              AND barkod IS NULL
              AND NOT EXISTS (SELECT 1 FROM mehsul_barkodlar b WHERE b.mehsul_id = mehsullar.id)
          ) AS barkodsuz,
          (SELECT COUNT(*)::bigint FROM mehsullar
            WHERE sahibkar_id = ${sahibkarId}::uuid AND aktiv = TRUE
              AND (alish_qiymeti IS NULL OR alish_qiymeti = 0)
          ) AS mayasiz,
          (SELECT COUNT(*)::bigint FROM mehsullar
            WHERE sahibkar_id = ${sahibkarId}::uuid AND aktiv = TRUE
              AND (sekil_url IS NULL OR sekil_url = '')
          ) AS sekilsiz,
          (SELECT COUNT(*)::bigint FROM mehsullar
            WHERE sahibkar_id = ${sahibkarId}::uuid AND aktiv = TRUE
              AND (satis_qiymeti IS NULL OR satis_qiymeti = 0)
          ) AS qiymetsiz
        FROM stok_per_mehsul spm
      `,
      // stok_bron uses `sayi` for the reserved quantity (not `miqdar`)
      prisma.stok_bron.aggregate({ _sum: { sayi: true } }),
    ]);

    const totals = stockTotals[0] ?? { total_qty: 0, total_value: 0 };
    const p = problems[0] ?? { zero_stok: 0n, low_stok: 0n, barkodsuz: 0n, mayasiz: 0n, sekilsiz: 0n, qiymetsiz: 0n };

    return {
      toplam_mehsul: productsCount,
      toplam_stok_vahid: Number(totals.total_qty),
      toplam_stok_deyer: Number(totals.total_value),
      zero_stok: Number(p.zero_stok),
      low_stok: Number(p.low_stok),
      rezerv_vahid: Number(rezervAgg._sum.sayi ?? 0),
      barkodsuz: Number(p.barkodsuz),
      mayasiz: Number(p.mayasiz),
      sekilsiz: Number(p.sekilsiz),
      qiymetsiz: Number(p.qiymetsiz),
    };
  });
}

export type ProductListRow = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  sekil_url: string | null;
  aciqlamaq: string | null;
  qisaca_tesvir: string | null;
  kateqoriya_id: number | null;
  kateqoriya_ad: string | null;
  kateqoriya_ust_ad: string | null;
  marka_id: number | null;
  marka_ad: string | null;
  olcu_id: number | null;
  olcu_ad: string | null;
  alish_qiymeti: number;
  satis_qiymeti: number;
  endirimli_qiymet: number | null;
  min_satis_qiymeti: number;
  topdan_qiymeti: number;
  partnyor_qiymeti: number;
  vip_qiymeti: number;
  komissiya_faiz: number;
  kritik_stok: number | null;
  min_stok: number | null;
  max_stok: number | null;
  stok_miqdari: number;
  anbar_sayi: number;
  /** Stoku olan anbarlar üzrə qısa breakdown (sıralı: çoxdan aza). */
  anbar_breakdown: Array<{ anbar_id: number; anbar_ad: string; miqdar: number }>;
  servis_sayi: number;
  model: string | null;
  rang: string | null;
  istehsalci: string | null;
  cheki_kg: number | null;
  hecm_m3: number | null;
  olculer: string | null;
  qutu_say: number | null;
  zemanet_ay: number;
  serial_lazim: boolean;
  imei_lazim: boolean;
  valyuta: string;
  edv_status: string;
  etiketsiz: boolean;
  yaradildi: Date | null;
  son_satis_de: Date | null;
  aktiv: boolean;
};

export type ProductFilter = {
  search?: string;
  kateqoriya_id?: number[];
  marka_id?: number[];
  stok_status?: ("var" | "yox" | "az")[];
  /** aktiv | deaktiv | hamisi (default aktiv) */
  aktiv_durum?: "aktiv" | "deaktiv" | "hamisi";
  /** true=image exists, false=no image */
  has_image?: boolean;
  /** true=has barcode, false=no barcode */
  has_barcode?: boolean;
  price_min?: number;
  price_max?: number;
  sirala?: string;
  /** Filter by warehouse — only products that have stock in this anbar */
  anbar_id?: number;
  /** true = only products that have at least one servis_qeyd */
  servisde_olmus?: boolean;
};

export async function getProducts(
  filter: ProductFilter,
  page = 1,
  pageSize = 50
): Promise<{ items: ProductListRow[]; total: number }> {
  // Hard cap — pageSize=99999 ilə search/sort blocking DB sorğusunu önləyir.
  pageSize = Math.min(Math.max(1, pageSize), 100);
  page = Math.max(1, page);
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    const durum = filter.aktiv_durum ?? "aktiv";
    if (durum === "aktiv") where.aktiv = true;
    else if (durum === "deaktiv") where.aktiv = false;
    // hamisi → no filter
    if (filter.kateqoriya_id?.length) where.kateqoriya_id = { in: filter.kateqoriya_id };
    if (filter.marka_id?.length) where.marka_id = { in: filter.marka_id };
    if (filter.search?.trim()) {
      const q = filter.search.trim();
      // Space-insensitive axtarış: "buds3" ↔ "buds 3" hər iki halı tapır.
      // Əvvəlcə ad/kod/barkod/model üçün space-insensitive ID-lər çıxarılır,
      // sonra bunlara aciqlamaq/marka/kateqoriya/əlavə barkod kimi standart axtarış
      // OR-larıyla birləşdirilir.
      const spaceInsensitiveIds = await searchProductIdsSpaceInsensitive(q, { limit: 500, activeOnly: false });
      where.OR = [
        ...(spaceInsensitiveIds.length > 0 ? [{ id: { in: spaceInsensitiveIds } }] : []),
        { aciqlamaq: { contains: q, mode: "insensitive" } },
        { markalar: { is: { ad: { contains: q, mode: "insensitive" } } } },
        { kateqoriyalar: { is: { ad: { contains: q, mode: "insensitive" } } } },
        { mehsul_barkodlar: { some: { barkod: { contains: q, mode: "insensitive" } } } },
      ];
    }
    if (filter.has_image === true) {
      where.AND = [...(where.AND ?? []), { sekil_url: { not: null } }, { NOT: { sekil_url: "" } }];
    } else if (filter.has_image === false) {
      where.AND = [...(where.AND ?? []), { OR: [{ sekil_url: null }, { sekil_url: "" }] }];
    }
    if (filter.has_barcode === true) where.barkod = { not: null };
    else if (filter.has_barcode === false) where.barkod = null;
    if (filter.price_min != null) where.satis_qiymeti = { ...(where.satis_qiymeti ?? {}), gte: filter.price_min };
    if (filter.price_max != null) where.satis_qiymeti = { ...(where.satis_qiymeti ?? {}), lte: filter.price_max };
    if (filter.anbar_id) where.stok = { some: { anbar_id: filter.anbar_id, miqdar: { gt: 0 } } };
    if (filter.servisde_olmus === true) where.servis_qeydleri = { some: {} };

    // Stok-əsaslı filter — mehsullar.stok_cemi denormalize sütunu (trigger ilə
    // avtomatik təzələnir). SQL səviyyəsində filter olunur, paginasiya doğru.
    if (filter.stok_status?.length) {
      const orClauses: Record<string, unknown>[] = [];
      if (filter.stok_status.includes("yox")) orClauses.push({ stok_cemi: { lte: 0 } });
      if (filter.stok_status.includes("az")) {
        // kritik səviyyədən aşağı, amma >0 — Prisma cross-column compare etmir,
        // ona görə raw filter ilə alt-pəncərə yığırıq.
        // Eyni mantıq SQL-də: stok_cemi > 0 AND stok_cemi <= kritik_stok
        // Burada yalnız stok_cemi > 0 filter qoyuruq, "az" detalı altdakı raw ilə.
        orClauses.push({ AND: [{ stok_cemi: { gt: 0 } }, { kritik_stok: { not: null } }] });
      }
      if (filter.stok_status.includes("var")) orClauses.push({ stok_cemi: { gt: 0 } });
      if (orClauses.length > 0) {
        where.OR = [...(where.OR ?? []), ...orClauses];
      }
    }

    // Map sort key to Prisma orderBy — stok_cemi indi DB sütunudur,
    // marja üçün (satis_qiymeti - alish_qiymeti) raw sort lazımdır (qoymuruq —
    // alternativ: alish_qiymeti ascending = aşağı maya → yüksək marja yaxınlığı).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderBy: any = (() => {
      switch (filter.sirala) {
        case "ad_desc":       return { ad: "desc" };
        case "qiymet_artan":  return { satis_qiymeti: "asc" };
        case "qiymet_azalan": return { satis_qiymeti: "desc" };
        case "yeni":          return { yaradildi: "desc" };
        case "son_satis":     return { son_satis_de: { sort: "asc", nulls: "first" } };
        case "stok_artan":    return { stok_cemi: "asc" };
        case "stok_azalan":   return { stok_cemi: "desc" };
        case "marja":
          // Marja təxminən: yüksək satış qiyməti / aşağı alış → yüksək marja.
          // Tam dəqiq deyil, amma DB-də sort üçün yaxşı approximation.
          return [{ satis_qiymeti: "desc" }, { alish_qiymeti: "asc" }];
        case "ad":
        default:              return { ad: "asc" };
      }
    })();

    const [items, total] = await Promise.all([
      prisma.mehsullar.findMany({
        where,
        orderBy,
        take: pageSize,
        skip: (page - 1) * pageSize,
        select: {
          id: true,
          ad: true,
          kod: true,
          barkod: true,
          sekil_url: true,
          aciqlamaq: true,
          kateqoriya_id: true,
          marka_id: true,
          olcu_id: true,
          alish_qiymeti: true,
          satis_qiymeti: true,
          endirimli_qiymet: true,
          min_satis_qiymeti: true,
          topdan_qiymeti: true,
          partnyor_qiymeti: true,
          vip_qiymeti: true,
          komissiya_faiz: true,
          kritik_stok: true,
          min_stok: true,
          max_stok: true,
          model: true,
          rang: true,
          istehsalci: true,
          cheki_kg: true,
          hecm_m3: true,
          olculer: true,
          qutu_say: true,
          zemanet_ay: true,
          serial_lazim: true,
          imei_lazim: true,
          valyuta: true,
          edv_status: true,
          etiketsiz: true,
          yaradildi: true,
          son_satis_de: true,
          qisaca_tesvir: true,
          aktiv: true,
          kateqoriyalar: {
            select: {
              ad: true,
              ust_id: true,
              kateqoriyalar: { select: { ad: true } },
            },
          },
          markalar: { select: { ad: true } },
          olcu_vahidleri: { select: { ad: true } },
          stok: {
            select: {
              miqdar: true,
              anbar_id: true,
              anbarlar: { select: { ad: true } },
            },
          },
          _count: { select: { servis_qeydleri: true } },
        },
      }),
      prisma.mehsullar.count({ where }),
    ]);

    const rows: ProductListRow[] = items.map((m) => {
      const stok_miqdari = m.stok.reduce((s, r) => s + Number(r.miqdar ?? 0), 0);
      // Unique warehouses where this product has any stock row
      const anbar_sayi = new Set(m.stok.filter((s) => Number(s.miqdar ?? 0) > 0).map((s) => s.anbar_id)).size;
      // Anbar breakdown — yalnız >0 olan, çoxdan aza sıralı
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stokAny = m.stok as any[];
      const anbar_breakdown = stokAny
        .map((s) => ({
          anbar_id: s.anbar_id as number,
          anbar_ad: s.anbarlar?.ad ?? "—",
          miqdar: Number(s.miqdar ?? 0),
        }))
        .filter((s) => s.miqdar > 0)
        .sort((a, b) => b.miqdar - a.miqdar);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const katAny = m.kateqoriyalar as any;
      const kateqoriya_ust_ad = katAny?.kateqoriyalar?.ad ?? null;
      return {
        id: m.id,
        ad: m.ad,
        kod: m.kod,
        barkod: m.barkod,
        sekil_url: m.sekil_url ?? null,
        aciqlamaq: m.aciqlamaq ?? null,
        qisaca_tesvir: m.qisaca_tesvir ?? null,
        kateqoriya_id: m.kateqoriya_id ?? null,
        kateqoriya_ad: m.kateqoriyalar?.ad ?? null,
        kateqoriya_ust_ad,
        marka_id: m.marka_id ?? null,
        marka_ad: m.markalar?.ad ?? null,
        olcu_id: m.olcu_id ?? null,
        olcu_ad: m.olcu_vahidleri?.ad ?? null,
        alish_qiymeti: Number(m.alish_qiymeti ?? 0),
        satis_qiymeti: Number(m.satis_qiymeti ?? 0),
        endirimli_qiymet: m.endirimli_qiymet != null ? Number(m.endirimli_qiymet) : null,
        min_satis_qiymeti: Number(m.min_satis_qiymeti ?? 0),
        topdan_qiymeti: Number(m.topdan_qiymeti ?? 0),
        partnyor_qiymeti: Number(m.partnyor_qiymeti ?? 0),
        vip_qiymeti: Number(m.vip_qiymeti ?? 0),
        komissiya_faiz: Number(m.komissiya_faiz ?? 0),
        kritik_stok: m.kritik_stok != null ? Number(m.kritik_stok) : null,
        min_stok: m.min_stok != null ? Number(m.min_stok) : null,
        max_stok: m.max_stok != null ? Number(m.max_stok) : null,
        stok_miqdari,
        anbar_sayi,
        anbar_breakdown,
        servis_sayi: m._count?.servis_qeydleri ?? 0,
        model: m.model ?? null,
        rang: m.rang ?? null,
        istehsalci: m.istehsalci ?? null,
        cheki_kg: m.cheki_kg != null ? Number(m.cheki_kg) : null,
        hecm_m3: m.hecm_m3 != null ? Number(m.hecm_m3) : null,
        olculer: m.olculer ?? null,
        qutu_say: m.qutu_say ?? null,
        zemanet_ay: m.zemanet_ay ?? 0,
        serial_lazim: m.serial_lazim ?? false,
        imei_lazim: m.imei_lazim ?? false,
        valyuta: m.valyuta ?? "AZN",
        edv_status: m.edv_status ?? "edv_var",
        etiketsiz: m.etiketsiz ?? false,
        yaradildi: m.yaradildi ?? null,
        son_satis_de: m.son_satis_de ?? null,
        aktiv: m.aktiv ?? false,
      };
    });

    // "az" filtri üçün post-DB refinement (kritik səviyyədən aşağı):
    // Prisma cross-column compare yox idi, ona görə kritik_stok-dan kiçik
    // olanları burada yoxlayırıq. Bu kiçik refinement-dir — ən pis halda
    // page boyunca bir neçə item filtrələnir.
    let filtered = rows;
    if (filter.stok_status?.length === 1 && filter.stok_status[0] === "az") {
      filtered = filtered.filter((r) => r.stok_miqdari > 0 && r.kritik_stok != null && r.stok_miqdari <= r.kritik_stok);
    }

    return { items: filtered, total };
  });
}

/**
 * Kateqoriya / marka / vahid — referans dataları nadir dəyişir.
 *
 * İki səviyyəli cache:
 *   1) `unstable_cache` — cross-request, sahibkar-key-li, 120s TTL.
 *      Eyni tenant-in 100 ardıcıl naviqasiyası 1 DB query edir.
 *   2) `cache()` (React) — eyni request boyu dedupe (auth/tenant lookup
 *      cost-unu azaldır).
 *
 * Tenant ID-ni request-də həll edib unstable_cache-ə parametr kimi veririk —
 * unstable_cache içindən cookie/headers-ə girmək olmur. `prismaUnscoped`
 * istifadə edirik, çünki sahibkar_id filter-i sorğunun özündə var.
 *
 * Invalidation: marka/kateqoriya/vahid yaradan-yeniləyən action-lar
 * `revalidateTag("ref:<tenant>:<kind>")` çağıracaq (TTL fallback 120s).
 */
const fetchCategoryOptionsCached = (tenantId: string) =>
  unstable_cache(
    async () =>
      prismaUnscoped.kateqoriyalar.findMany({
        where: { sahibkar_id: tenantId },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true, ust_id: true },
      }),
    ["ref-categories", tenantId],
    { revalidate: 120, tags: [`ref:${tenantId}:categories`] },
  );

const fetchBrandOptionsCached = (tenantId: string) =>
  unstable_cache(
    async () =>
      prismaUnscoped.markalar.findMany({
        where: { sahibkar_id: tenantId, aktiv: true },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true },
      }),
    ["ref-brands", tenantId],
    { revalidate: 120, tags: [`ref:${tenantId}:brands`] },
  );

const fetchUnitOptionsCached = (tenantId: string) =>
  unstable_cache(
    async () =>
      prismaUnscoped.olcu_vahidleri.findMany({
        where: { sahibkar_id: tenantId },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true, qisa_ad: true },
      }),
    ["ref-units", tenantId],
    { revalidate: 120, tags: [`ref:${tenantId}:units`] },
  );

export const getCategoryOptions = cache(async () => {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchCategoryOptionsCached(sahibkarId)();
  });
});

export const getBrandOptions = cache(async () => {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchBrandOptionsCached(sahibkarId)();
  });
});

export const getUnitOptions = cache(async () => {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchUnitOptionsCached(sahibkarId)();
  });
});

export type BrandFilter = {
  search?: string;
  aktiv_durum?: "aktiv" | "deaktiv" | "hamisi";
  has_logo?: boolean;
  sirala?: string;
};

export async function getBrands(filter: BrandFilter = {}) {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    const durum = filter.aktiv_durum ?? "aktiv";
    if (durum === "aktiv") where.aktiv = true;
    else if (durum === "deaktiv") where.aktiv = false;
    if (filter.search?.trim()) {
      where.ad = { contains: filter.search.trim(), mode: "insensitive" };
    }
    if (filter.has_logo === true) {
      where.AND = [{ logo_url: { not: null } }, { NOT: { logo_url: "" } }];
    } else if (filter.has_logo === false) {
      where.OR = [{ logo_url: null }, { logo_url: "" }];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderBy: any =
      filter.sirala === "ad_desc" ? { ad: "desc" } : { ad: "asc" };

    const rows = await prisma.markalar.findMany({
      where,
      orderBy,
      include: { _count: { select: { mehsullar: true } } },
    });
    return rows.map((m) => ({
      id: m.id,
      ad: m.ad,
      qeyd: m.qeyd,
      aktiv: m.aktiv ?? true,
      logo_url: m.logo_url ?? null,
      mehsul_sayi: m._count.mehsullar,
    }));
  });
}
