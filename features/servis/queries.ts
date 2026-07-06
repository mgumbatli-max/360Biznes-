import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { ServisRow, ZemanetRow } from "./types";
import { searchProductIdsSpaceInsensitive } from "@/lib/db/space-insensitive-search";

const OPEN_STATUSES = [
  "qebul_edildi",
  "diaqnostikada",
  "teklif_gozleyir",
  "usta_baxir",
  "ehtiyat_hisse",
  "temir_olunur",
] as const;

/**
 * Tries to extract a `prioritet:<x>` tag from daxili_qeyd. Falls back to "orta".
 * (The schema has no native priority column; we keep priority inline-tagged.)
 */
function readPriority(daxili: string | null | undefined): string {
  if (!daxili) return "orta";
  const m = /\bprioritet:(asagi|orta|yuksek|tecili)\b/i.exec(daxili);
  return m ? m[1].toLowerCase() : "orta";
}

export type ServisListFilter = {
  q?: string;
  status?: string;
  prioritet?: string;
  iscisi_id?: string;
  zemanet_only?: boolean;
  from?: Date | null;
  to?: Date | null;
  /** Servis qeydlərində açıq (yəni hələ qapadılmamış) olanları seç. */
  acig_only?: boolean;
  /** Vəd tarixini keçmiş, hələ açıq olan servislər. */
  gecikme_only?: boolean;
  /** Yalnız tam ödənilmiş (musteriden_alinan ≥ temir_xerci və temir_xerci > 0). */
  odenilmis_only?: boolean;
  filial_id?: number | null;
  marka_id?: number | null;
  kateqoriya_id?: number | null;
  /** Defekt kateqoriyası (servis_defekt_kateq.id). */
  defekt_kateq_id?: number | null;
  /** Yalnız xarici (kənar) servisə göndərilənlər. */
  xarici_only?: boolean;
  /** Soft-delete standart filter */
  recordStatus?: "aktiv" | "silinmis" | "hamisi";
};

export async function getServisRequests(filter: ServisListFilter = {}): Promise<ServisRow[]> {
  return withTenant(async () => {
    const where: Prisma.servis_qeydleriWhereInput = {};
    // SOFT-DELETE: standart filter
    const rs = filter.recordStatus ?? "aktiv";
    if (rs === "aktiv") {
      (where as Record<string, unknown>).deleted_at = null;
      // QA-standart: Aktiv = ləğv edilməmiş də (istifadəçi seçsə görünür)
      if (!filter.status || (Array.isArray(filter.status) && filter.status.length === 0)) (where as Record<string, unknown>).status = { not: "legv" };
    }
    else if (rs === "silinmis") {
      // ləğvlilər də "silinmişlər"də görünür
      ((where as Record<string, unknown>) as Record<string, unknown>).AND = [ { OR: [ { deleted_at: { not: null } }, { status: "legv" } ] } ];
    }
    if (filter.status) where.status = filter.status;
    if (filter.iscisi_id) where.servis_iscisi_id = filter.iscisi_id;
    if (filter.zemanet_only) where.zemanet_var = true;
    if (filter.xarici_only) where.xarici_servis = true;
    if (filter.filial_id != null) where.filial_id = filter.filial_id;
    if (filter.defekt_kateq_id != null) where.defekt_kateq_id = filter.defekt_kateq_id;
    if (filter.from || filter.to) {
      const dateRange: { gte?: Date; lte?: Date } = {};
      if (filter.from) dateRange.gte = filter.from;
      if (filter.to) dateRange.lte = filter.to;
      where.yaradildi = dateRange;
    }
    if (filter.acig_only) {
      where.status = { in: OPEN_STATUSES as unknown as string[] };
    }
    if (filter.gecikme_only) {
      where.status = { in: OPEN_STATUSES as unknown as string[] };
      where.texmini_tehvil = { lt: new Date() };
    }
    if (filter.marka_id != null || filter.kateqoriya_id != null) {
      const mehsulFilter: Prisma.mehsullarWhereInput = {};
      if (filter.marka_id != null) mehsulFilter.marka_id = filter.marka_id;
      if (filter.kateqoriya_id != null) mehsulFilter.kateqoriya_id = filter.kateqoriya_id;
      where.mehsullar = mehsulFilter;
    }
    if (filter.q) {
      const q = filter.q.trim();
      // Boşluqdan asılı olmayan məhsul axtarışı: "buds3" ↔ "buds 3".
      const matchedIds = await searchProductIdsSpaceInsensitive(q, { limit: 500, activeOnly: false });
      where.OR = [
        { nomre: { contains: q, mode: "insensitive" } },
        { musteri_ad: { contains: q, mode: "insensitive" } },
        { musteri_telefon: { contains: q } },
        { mehsul_ad: { contains: q, mode: "insensitive" } },
        { mehsul_seri_nomresi: { contains: q, mode: "insensitive" } },
        { problem_tesviri: { contains: q, mode: "insensitive" } },
        { texniki_qeyd: { contains: q, mode: "insensitive" } },
        { daxili_qeyd: { contains: q, mode: "insensitive" } },
        ...(matchedIds.length > 0 ? [{ mehsul_id: { in: matchedIds } }] : []),
      ];
    }

    const rows = await prisma.servis_qeydleri.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 500,
      include: {
        mehsullar: { select: { id: true, kod: true, barkod: true } },
        istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler: { select: { ad_soyad: true } },
        istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler: { select: { ad_soyad: true } },
      },
    });

    // Filial adlarını ayrı qaynaqdan oxu — daha sadə cədvəl join-i.
    const filialIds = Array.from(new Set(rows.map((r) => r.filial_id).filter((v): v is number => v != null)));
    const { sahibkarId } = requireTenant();
    const filiallar = filialIds.length
      ? await prisma.filiallar.findMany({
          where: { sahibkar_id: sahibkarId, id: { in: filialIds } },
          select: { id: true, ad: true },
        })
      : [];
    const filialMap = new Map(filiallar.map((f) => [f.id, f.ad] as const));

    // Build "yenidenGelen" by counting same musteri_telefon
    const phoneCount = new Map<string, number>();
    for (const r of rows) phoneCount.set(r.musteri_telefon, (phoneCount.get(r.musteri_telefon) ?? 0) + 1);

    let mapped: ServisRow[] = rows.map((r) => ({
      id: r.id,
      nomre: r.nomre,
      yaradildi: r.yaradildi,
      musteri_id: r.musteri_id,
      musteri_ad: r.musteri_ad,
      musteri_telefon: r.musteri_telefon,
      mehsul_id: r.mehsul_id ?? r.mehsullar?.id ?? null,
      mehsul_ad: r.mehsul_ad,
      mehsul_kod: r.mehsullar?.kod ?? null,
      mehsul_barkod: r.mehsullar?.barkod ?? null,
      mehsul_seri_nomresi: r.mehsul_seri_nomresi,
      problem_tesviri: r.problem_tesviri,
      status: r.status,
      prioritet: readPriority(r.daxili_qeyd),
      servis_iscisi_ad: r.istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler?.ad_soyad ?? null,
      qebul_eden_ad: r.istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler?.ad_soyad ?? null,
      texmini_tehvil: r.texmini_tehvil,
      qapanma_tarixi: r.qapanma_tarixi,
      zemanet_var: r.zemanet_var,
      zemanet_baslama: r.zemanet_baslama,
      zemanet_bitme: r.zemanet_bitme,
      temir_xerci: Number(r.temir_xerci ?? 0),
      musteriden_alinan: Number(r.musteriden_alinan ?? 0),
      satis_id: r.satis_id,
      satis_tarixi: r.satis_tarixi,
      filial_id: r.filial_id,
      filial_ad: r.filial_id != null ? (filialMap.get(r.filial_id) ?? null) : null,
      yenidenGelen: (phoneCount.get(r.musteri_telefon) ?? 0) > 1,
    }));

    if (filter.prioritet) mapped = mapped.filter((r) => r.prioritet === filter.prioritet);
    if (filter.odenilmis_only) {
      mapped = mapped.filter((r) => r.temir_xerci > 0 && r.musteriden_alinan >= r.temir_xerci);
    }

    return mapped;
  });
}

const fetchServisStatsCached = (sahibkarId: string) =>
  unstable_cache(
    async () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [open, weekIn, weekOut, late, avgDays, monthRevenue, byStatus] = await Promise.all([
        prismaUnscoped.servis_qeydleri.count({ where: { sahibkar_id: sahibkarId, status: { in: OPEN_STATUSES as unknown as string[] } } }),
        prismaUnscoped.servis_qeydleri.count({ where: { sahibkar_id: sahibkarId, yaradildi: { gte: weekStart } } }),
        prismaUnscoped.servis_qeydleri.count({
          where: { sahibkar_id: sahibkarId, status: "musteriye_tehvil", qapanma_tarixi: { gte: weekStart } },
        }),
        prismaUnscoped.servis_qeydleri.count({
          where: {
            sahibkar_id: sahibkarId,
            status: { in: OPEN_STATUSES as unknown as string[] },
            texmini_tehvil: { lt: now },
          },
        }),
        prismaUnscoped.$queryRaw<{ avg: number | null }[]>`
          SELECT AVG(EXTRACT(EPOCH FROM (qapanma_tarixi - yaradildi)) / 86400)::float AS avg
            FROM servis_qeydleri
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND qapanma_tarixi IS NOT NULL
             AND yaradildi IS NOT NULL
             AND status = 'musteriye_tehvil'
        `,
        prismaUnscoped.servis_qeydleri.aggregate({
          where: { sahibkar_id: sahibkarId, qapanma_tarixi: { gte: monthStart } },
          _sum: { musteriden_alinan: true },
        }),
        prismaUnscoped.servis_qeydleri.groupBy({
          by: ["status"],
          where: { sahibkar_id: sahibkarId },
          _count: { _all: true },
        }),
      ]);

      const [ready, delivered, totalRevenue] = await Promise.all([
        prismaUnscoped.servis_qeydleri.count({ where: { sahibkar_id: sahibkarId, status: "temir_edildi" } }),
        prismaUnscoped.servis_qeydleri.count({ where: { sahibkar_id: sahibkarId, status: "musteriye_tehvil" } }),
        prismaUnscoped.servis_qeydleri.aggregate({ where: { sahibkar_id: sahibkarId }, _sum: { musteriden_alinan: true } }),
      ]);

      const statusCounts: Record<string, number> = {};
      for (const g of byStatus) {
        if (g.status) statusCounts[g.status] = g._count._all;
      }

      return {
        acig: open,
        hazir: ready,
        teslim: delivered,
        gelir_cemi: Number(totalRevenue._sum.musteriden_alinan ?? 0),
        week_in: weekIn,
        week_out: weekOut,
        late,
        avg_days: avgDays[0]?.avg ? Number(avgDays[0].avg.toFixed(1)) : 0,
        month_revenue: Number(monthRevenue._sum.musteriden_alinan ?? 0),
        by_status: statusCounts,
      };
    },
    ["servis-stats", sahibkarId],
    { revalidate: 60, tags: [`servis:${sahibkarId}`, `dashboard:${sahibkarId}`] },
  );

export async function getServisStats() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchServisStatsCached(sahibkarId)();
  });
}

export async function getServisDetail(id: string) {
  return withTenant(async () =>
    prisma.servis_qeydleri.findUnique({
      where: { id },
      include: {
        istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler: { select: { id: true, ad_soyad: true } },
        istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler: { select: { id: true, ad_soyad: true } },
        istifadeciler_servis_qeydleri_qapayan_idToistifadeciler: { select: { id: true, ad_soyad: true } },
        mehsullar: { select: { id: true, ad: true, kod: true, barkod: true } },
        kontragentler: { select: { id: true, ad: true, telefon: true } },
        filiallar: { select: { id: true, ad: true } },
        servis_status_tarixce: { orderBy: { yaradildi: "asc" } },
        servis_fayllari: { orderBy: { yaradildi: "desc" } },
        servis_defekt_kateq: { select: { id: true, kod: true, ad: true, qrup: true } },
        zemanetler: { select: { id: true, unikal_kod: true, qr_token: true, bitme_tarixi: true, status: true } },
        satis_sifarisleri: { select: { id: true, nomre: true } },
      },
    })
  );
}

/**
 * Servis modal pəncərə üçün hazır JSON payload.
 * Cədvəl sətrinə klikləndikdə fetch edilir və ServisDetailModal-a verilir.
 * Bütün istinad olunan obyektlər (fayllar, tarixçə, tapşırıqlar, ödənişlər, hesablar) bir paketdə.
 */
export async function getServisFullDetail(id: string) {
  return withTenant(async () => {
    const s = await prisma.servis_qeydleri.findUnique({
      where: { id },
      include: {
        istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler: { select: { id: true, ad_soyad: true } },
        istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler: { select: { id: true, ad_soyad: true } },
        mehsullar: { select: { id: true, ad: true, kod: true, barkod: true } },
        kontragentler: { select: { id: true, ad: true, telefon: true, email: true } },
        servis_status_tarixce: {
          orderBy: { yaradildi: "asc" },
          include: {
            istifadeciler: { select: { ad_soyad: true } },
          },
        },
        servis_fayllari: { orderBy: { yaradildi: "desc" } },
      },
    });
    if (!s) return null;

    // Ödəniş tarixçəsi
    const payments = await prisma.finance_operations.findMany({
      where: { servis_id: id },
      orderBy: { yaradildi: "desc" },
      include: {
        maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari: {
          select: { ad: true, nov: true },
        },
        finance_operation_types: { select: { ad: true, kod: true } },
      },
    });

    // Bağlı tapşırıqlar — tapshiriq_obyektleri (obyekt_nov=servis, obyekt_id=id)
    const taskLinks = await prisma.tapshiriq_obyektleri.findMany({
      where: { obyekt_nov: "servis", obyekt_id: id },
      take: 50,
      include: {
        tapshiriqlar: {
          include: {
            istifadeciler_tapshiriqlar_mesul_idToistifadeciler: {
              select: { ad_soyad: true },
            },
          },
        },
      },
    });

    // Maliyə hesabları (PaymentForm üçün)
    const accounts = await prisma.maliye_hesablari.findMany({
      where: { aktiv: true },
      orderBy: [{ nov: "asc" }, { ad: "asc" }],
      select: { id: true, ad: true, nov: true },
      take: 100,
    });

    return {
      id: s.id,
      nomre: s.nomre,
      status: s.status,
      musteri_ad: s.musteri_ad,
      musteri_telefon: s.musteri_telefon,
      musteri_email: s.kontragentler?.email ?? null,
      musteri_id: s.musteri_id,
      mehsul_ad: s.mehsul_ad,
      mehsul_seri_nomresi: s.mehsul_seri_nomresi,
      mehsul_id: s.mehsul_id ?? s.mehsullar?.id ?? null,
      mehsul_kod: s.mehsullar?.kod ?? null,
      mehsul_barkod: s.mehsullar?.barkod ?? null,
      problem_tesviri: s.problem_tesviri,
      yaradildi: s.yaradildi,
      texmini_tehvil: s.texmini_tehvil,
      qapanma_tarixi: s.qapanma_tarixi,
      zemanet_var: s.zemanet_var,
      zemanet_baslama: s.zemanet_baslama,
      zemanet_bitme: s.zemanet_bitme,
      qebul_eden_ad: s.istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler?.ad_soyad ?? null,
      servis_iscisi_ad: s.istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler?.ad_soyad ?? null,
      temir_xerci: Number(s.temir_xerci ?? 0),
      musteriden_alinan: Number(s.musteriden_alinan ?? 0),
      netice_aciqlamasi: s.netice_aciqlamasi,
      satis_id: s.satis_id,
      fayllar: s.servis_fayllari.map((f) => ({
        id: f.id,
        fayl_adi: f.fayl_adi,
        orijinal_adi: f.orijinal_adi,
        nov: f.nov,
        aciqlama: f.aciqlama,
        olcu_bayt: f.olcu_bayt,
        mime_tip: f.mime_tip,
        yaradildi: f.yaradildi,
      })),
      tarixce: s.servis_status_tarixce.map((t) => ({
        id: t.id,
        evvelki_status: t.evvelki_status,
        yeni_status: t.yeni_status,
        qeyd: t.qeyd,
        yaradildi: t.yaradildi,
        deyisen_ad: t.istifadeciler?.ad_soyad ?? t.deyisen_ad ?? null,
      })),
      tapsiriqlar: taskLinks.map((tl) => ({
        id: tl.tapshiriqlar.id,
        basliq: tl.tapshiriqlar.basliq,
        status: tl.tapshiriqlar.status ?? null,
        prioritet: tl.tapshiriqlar.prioritet ?? null,
        deadline: tl.tapshiriqlar.deadline,
        mesul_ad: tl.tapshiriqlar.istifadeciler_tapshiriqlar_mesul_idToistifadeciler?.ad_soyad ?? null,
      })),
      odeniyler: payments.map((o) => ({
        id: o.id,
        tarix: o.tarix,
        yaradildi: o.yaradildi,
        meblegh: Number(o.meblegh ?? 0),
        valyuta: o.valyuta ?? "AZN",
        hesab_ad: o.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.ad ?? null,
        hesab_nov: o.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.nov ?? null,
        type_kod: o.type_kod,
        type_ad: o.finance_operation_types?.ad ?? null,
        qeyd: o.qeyd ?? null,
      })),
      accounts: accounts.map((a) => ({ id: a.id, ad: a.ad, nov: a.nov ?? "" })),
    };
  });
}

/**
 * Defekt kategoriya seçimləri — servis dialog dropdown üçün.
 * Yalnız aktiv olanları gətir.
 */
export async function getDefektKategoriyalar() {
  return withTenant(() =>
    prisma.servis_defekt_kateq.findMany({
      where: { aktiv: true },
      orderBy: [{ qrup: "asc" }, { ad: "asc" }],
      select: { id: true, kod: true, ad: true, qrup: true, default_kateq: true },
      take: 200,
    })
  );
}

/**
 * Servis akt şablonları — "Akt çap et" dropdown üçün.
 */
export async function getAktSablonlari() {
  return withTenant(() =>
    prisma.servis_akt_sablonlari.findMany({
      where: { aktiv: true },
      orderBy: [{ default_sablon: "desc" }, { ad: "asc" }],
      select: { id: true, ad: true, nov: true, format: true, default_sablon: true },
      take: 100,
    })
  );
}

/**
 * Açıq müştəri tracking — autentifikasiyasız çağırılır.
 * `daxili_qeyd` qaytarılmır.
 * Token = qr_token (zəmanət) və ya servis id-nin son 8 simvolu.
 *
 * Bu funksiya `prismaUnscoped` istifadə edir, çünki public endpoint-dir
 * (auth yox → tenant kontekst yox).
 */
export async function getServisTrackByToken(token: string) {
  if (!token || token.length < 4) return null;
  // Önce zəmanət qr_token ilə müqayisə et
  const z = await prismaUnscoped.zemanetler.findFirst({
    where: { qr_token: token },
    select: { servis_id: true },
  });
  let servisId: string | null = z?.servis_id ?? null;

  if (!servisId) {
    // Servis id-nin son 8 simvolu ilə müqayisə
    const tokenSuffix = token.slice(-8).toLowerCase();
    const rows = await prismaUnscoped.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id
        FROM servis_qeydleri
       WHERE RIGHT(id::text, 8) = ${tokenSuffix}
       ORDER BY yaradildi DESC NULLS LAST
       LIMIT 1
    `;
    if (rows[0]) servisId = rows[0].id;
  }
  if (!servisId) return null;

  const s = await prismaUnscoped.servis_qeydleri.findUnique({
    where: { id: servisId },
    select: {
      id: true,
      nomre: true,
      status: true,
      yaradildi: true,
      texmini_tehvil: true,
      qapanma_tarixi: true,
      musteri_ad: true,
      musteri_telefon: true,
      mehsul_ad: true,
      mehsul_seri_nomresi: true,
      problem_tesviri: true,
      temir_xerci: true,
      musteriden_alinan: true,
      sahibkar_id: true,
      // daxili_qeyd qəsdən EXCLUDE — müştəri-üzü yox
      servis_status_tarixce: {
        orderBy: { yaradildi: "asc" },
        select: {
          id: true,
          evvelki_status: true,
          yeni_status: true,
          qeyd: true,
          yaradildi: true,
        },
      },
      sahibkarlar: { select: { ad: true } },
    },
  });
  if (!s) return null;

  // Müştəri-üzü filter: yalnız status keçidlərini göstər;
  // "qeyd" pseudo-status (daxili repair notes) gizlət.
  const publicTimeline = s.servis_status_tarixce.filter((t) => t.yeni_status !== "qeyd");

  return {
    ...s,
    temir_xerci: Number(s.temir_xerci ?? 0),
    musteriden_alinan: Number(s.musteriden_alinan ?? 0),
    servis_status_tarixce: publicTimeline,
  };
}

// QA-perf: servis dialoqunda hər açılışda çağırılan reference siyahıları — nadir dəyişir, cache-lənir.
// TENANT-TƏHLÜKƏSİZ: unstable_cache daxilində tenant konteksti YOXDUR → prismaUnscoped + açıq sahibkar_id
// filtri + cache açarında sahibkarId (cross-tenant sızma önlənir). Mutasiyalarda `ref:${sahibkarId}:*` tag-i.
export async function getFiliallar() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return unstable_cache(
      () => prismaUnscoped.filiallar.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        orderBy: { ad: "asc" }, select: { id: true, ad: true },
      }),
      ["servis-filiallar", sahibkarId],
      { revalidate: 300, tags: [`ref:${sahibkarId}:filiallar`] },
    )();
  });
}

/**
 * Active product list for ServisDialog product-picker (light fields).
 * Limited to 500 to keep dropdown responsive.
 */
export async function getMehsulOptionsForServis() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return unstable_cache(
      () => prismaUnscoped.mehsullar.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        orderBy: { ad: "asc" }, select: { id: true, ad: true, kod: true, barkod: true }, take: 500,
      }),
      ["servis-mehsul-opt", sahibkarId],
      { revalidate: 60, tags: [`ref:${sahibkarId}:mehsul`] },
    )();
  });
}

/**
 * Customer list for ServisDialog musteri-picker.
 */
export async function getMusteriOptionsForServis() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return unstable_cache(
      () => prismaUnscoped.kontragentler.findMany({
        where: { sahibkar_id: sahibkarId, nov: "musteri" },
        orderBy: { ad: "asc" }, select: { id: true, ad: true, telefon: true }, take: 500,
      }),
      ["servis-musteri-opt", sahibkarId],
      { revalidate: 60, tags: [`ref:${sahibkarId}:musteri`] },
    )();
  });
}

/**
 * Active financial accounts (cash + bank) for payment-form kassa picker.
 */
export async function getMaliyeAccountsForServis() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return unstable_cache(
      () => prismaUnscoped.maliye_hesablari.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        orderBy: [{ nov: "asc" }, { ad: "asc" }], select: { id: true, ad: true, nov: true, valyuta: true }, take: 100,
      }),
      ["servis-maliye-hesab", sahibkarId],
      { revalidate: 120, tags: [`ref:${sahibkarId}:hesab`] },
    )();
  });
}

/**
 * Full servis history for a given product (by mehsul_id link).
 * Used in /anbar/mehsullar/[id] detail page "Servis tarixçəsi" tab.
 */
export async function getServisHistoryForProduct(mehsul_id: string) {
  return withTenant(async () => {
    const rows = await prisma.servis_qeydleri.findMany({
      where: { mehsul_id },
      orderBy: { yaradildi: "desc" },
      take: 200,
      include: {
        istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler: { select: { ad_soyad: true } },
        istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler: { select: { ad_soyad: true } },
      },
    });

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const activeStatuses = new Set([
      "qebul_edildi",
      "diaqnostikada",
      "teklif_gozleyir",
      "usta_baxir",
      "ehtiyat_hisse",
      "temir_olunur",
    ]);

    const total = rows.length;
    let thisYear = 0;
    let active = 0;
    for (const r of rows) {
      if (r.yaradildi && r.yaradildi >= yearStart) thisYear++;
      if (activeStatuses.has(r.status)) active++;
    }

    return {
      rows: rows.map((r) => ({
        id: r.id,
        nomre: r.nomre,
        yaradildi: r.yaradildi,
        musteri_ad: r.musteri_ad,
        musteri_telefon: r.musteri_telefon,
        problem_tesviri: r.problem_tesviri,
        status: r.status,
        temir_xerci: Number(r.temir_xerci ?? 0),
        musteriden_alinan: Number(r.musteriden_alinan ?? 0),
        qapanma_tarixi: r.qapanma_tarixi,
        texniki_ad: r.istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler?.ad_soyad ?? null,
        qebul_eden_ad: r.istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler?.ad_soyad ?? null,
      })),
      stats: { total, thisYear, active },
    };
  });
}

/**
 * All payments (finance_operations) tied to a given servis.
 * Used in /servis/[id] "Ödəniş" tab payments list.
 */
export async function getServisPayments(servis_id: string) {
  return withTenant(async () => {
    const ops = await prisma.finance_operations.findMany({
      where: { servis_id },
      orderBy: { yaradildi: "desc" },
      include: {
        maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari: {
          select: { ad: true, nov: true },
        },
        finance_operation_types: { select: { ad: true, kod: true } },
      },
    });
    return ops.map((o) => ({
      id: o.id,
      tarix: o.tarix,
      yaradildi: o.yaradildi,
      meblegh: Number(o.meblegh ?? 0),
      valyuta: o.valyuta ?? "AZN",
      hesab_ad: o.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.ad ?? null,
      hesab_nov: o.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.nov ?? null,
      type_kod: o.type_kod,
      type_ad: o.finance_operation_types?.ad ?? null,
      qeyd: o.qeyd ?? null,
    }));
  });
}

export async function getMarkaOptionsForServis() {
  return withTenant(() =>
    prisma.markalar.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
      take: 200,
    })
  );
}

export async function getKateqoriyaOptionsForServis() {
  return withTenant(() =>
    prisma.kateqoriyalar.findMany({
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
      take: 200,
    })
  );
}

/**
 * Problemli məhsullar — bütün servis qeydlərini məhsul üzrə qruplayır.
 * Filter: kateqoriya/marka/tarix.
 */
export type ProblemMehsulFilter = {
  marka_id?: number | null;
  kateqoriya_id?: number | null;
  from?: Date | null;
  to?: Date | null;
};

export type ProblemMehsulRow = {
  mehsul_id: string | null;
  mehsul_ad: string;
  marka: string | null;
  kateqoriya: string | null;
  servis_sayi: number;
  aktiv_say: number;
  son_tarix: Date | null;
  ilk_tarix: Date | null;
  avg_gun: number;
  cemi_gelir: number;
  top_problem: string | null;
};

export async function getProblemMehsullar(filter: ProblemMehsulFilter = {}): Promise<ProblemMehsulRow[]> {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;

    const conds: Prisma.Sql[] = [Prisma.sql`s.sahibkar_id = ${tenantId}::uuid`];
    if (filter.from) conds.push(Prisma.sql`s.yaradildi >= ${filter.from}`);
    if (filter.to) conds.push(Prisma.sql`s.yaradildi <= ${filter.to}`);
    if (filter.marka_id != null) conds.push(Prisma.sql`m.marka_id = ${filter.marka_id}`);
    if (filter.kateqoriya_id != null) conds.push(Prisma.sql`m.kateqoriya_id = ${filter.kateqoriya_id}`);
    const whereSql = Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}`;

    const rows = await prisma.$queryRaw<{
      mehsul_id: string | null;
      mehsul_ad: string;
      marka: string | null;
      kateqoriya: string | null;
      servis_sayi: bigint;
      aktiv_say: bigint;
      son_tarix: Date | null;
      ilk_tarix: Date | null;
      avg_gun: number | null;
      cemi_gelir: number | null;
      top_problem: string | null;
    }[]>`
      SELECT s.mehsul_id,
             MAX(s.mehsul_ad) AS mehsul_ad,
             MAX(mk.ad) AS marka,
             MAX(kt.ad) AS kateqoriya,
             COUNT(*) AS servis_sayi,
             COUNT(*) FILTER (
               WHERE s.status IN ('qebul_edildi','diaqnostikada','teklif_gozleyir','usta_baxir','ehtiyat_hisse','temir_olunur')
             ) AS aktiv_say,
             MAX(s.yaradildi) AS son_tarix,
             MIN(s.yaradildi) AS ilk_tarix,
             AVG(EXTRACT(EPOCH FROM (s.qapanma_tarixi - s.yaradildi))/86400)::float AS avg_gun,
             COALESCE(SUM(s.musteriden_alinan), 0)::float AS cemi_gelir,
             (
               SELECT LEFT(s2.problem_tesviri, 120)
                 FROM servis_qeydleri s2
                WHERE s2.sahibkar_id = ${tenantId}::uuid
                  AND ((s.mehsul_id IS NOT NULL AND s2.mehsul_id = s.mehsul_id)
                       OR (s.mehsul_id IS NULL AND s2.mehsul_ad = MAX(s.mehsul_ad)))
                ORDER BY s2.yaradildi DESC NULLS LAST
                LIMIT 1
             ) AS top_problem
        FROM servis_qeydleri s
        LEFT JOIN mehsullar m ON m.id = s.mehsul_id
        LEFT JOIN markalar mk ON mk.id = m.marka_id
        LEFT JOIN kateqoriyalar kt ON kt.id = m.kateqoriya_id
        ${whereSql}
        GROUP BY s.mehsul_id
        ORDER BY servis_sayi DESC
        LIMIT 200
    `;

    return rows.map((r) => ({
      mehsul_id: r.mehsul_id,
      mehsul_ad: r.mehsul_ad ?? "—",
      marka: r.marka ?? null,
      kateqoriya: r.kateqoriya ?? null,
      servis_sayi: Number(r.servis_sayi),
      aktiv_say: Number(r.aktiv_say),
      son_tarix: r.son_tarix,
      ilk_tarix: r.ilk_tarix,
      avg_gun: r.avg_gun ? Math.round(r.avg_gun * 10) / 10 : 0,
      cemi_gelir: Number(r.cemi_gelir ?? 0),
      top_problem: r.top_problem,
    }));
  });
}

/** Konkret məhsul üzrə bütün servis qeydlərini gətir (problemli məhsul detalı üçün). */
export async function getServisQeydleriByProduct(opts: {
  mehsul_id?: string | null;
  mehsul_ad?: string | null;
}): Promise<ServisRow[]> {
  return withTenant(async () => {
    const where: Prisma.servis_qeydleriWhereInput = opts.mehsul_id
      ? { mehsul_id: opts.mehsul_id }
      : { mehsul_id: null, mehsul_ad: opts.mehsul_ad ?? "" };

    const rows = await prisma.servis_qeydleri.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 200,
      include: {
        mehsullar: { select: { id: true, kod: true, barkod: true } },
        istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler: { select: { ad_soyad: true } },
        istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler: { select: { ad_soyad: true } },
      },
    });

    const filialIds = Array.from(new Set(rows.map((r) => r.filial_id).filter((v): v is number => v != null)));
    const filiallar = filialIds.length
      ? await prisma.filiallar.findMany({
          where: { id: { in: filialIds } },
          select: { id: true, ad: true },
        })
      : [];
    const filialMap = new Map(filiallar.map((f) => [f.id, f.ad] as const));

    return rows.map((r) => ({
      id: r.id,
      nomre: r.nomre,
      yaradildi: r.yaradildi,
      musteri_id: r.musteri_id,
      musteri_ad: r.musteri_ad,
      musteri_telefon: r.musteri_telefon,
      mehsul_id: r.mehsul_id ?? r.mehsullar?.id ?? null,
      mehsul_ad: r.mehsul_ad,
      mehsul_kod: r.mehsullar?.kod ?? null,
      mehsul_barkod: r.mehsullar?.barkod ?? null,
      mehsul_seri_nomresi: r.mehsul_seri_nomresi,
      problem_tesviri: r.problem_tesviri,
      status: r.status,
      prioritet: readPriority(r.daxili_qeyd),
      servis_iscisi_ad: r.istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler?.ad_soyad ?? null,
      qebul_eden_ad: r.istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler?.ad_soyad ?? null,
      texmini_tehvil: r.texmini_tehvil,
      qapanma_tarixi: r.qapanma_tarixi,
      zemanet_var: r.zemanet_var,
      zemanet_baslama: r.zemanet_baslama,
      zemanet_bitme: r.zemanet_bitme,
      temir_xerci: Number(r.temir_xerci ?? 0),
      musteriden_alinan: Number(r.musteriden_alinan ?? 0),
      satis_id: r.satis_id,
      satis_tarixi: r.satis_tarixi,
      filial_id: r.filial_id,
      filial_ad: r.filial_id != null ? (filialMap.get(r.filial_id) ?? null) : null,
      yenidenGelen: false,
    }));
  });
}

export async function getProblemMehsulSummary(): Promise<{
  total: number;
  uniq: number;
  top: { mehsul_ad: string; say: number } | null;
}> {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;
    const rows = await prisma.$queryRaw<{ mehsul_ad: string; say: bigint }[]>`
      SELECT s.mehsul_ad, COUNT(*)::bigint AS say
        FROM servis_qeydleri s
       WHERE s.sahibkar_id = ${tenantId}::uuid
       GROUP BY s.mehsul_ad
       ORDER BY say DESC
       LIMIT 1
    `;
    const totalRow = await prisma.$queryRaw<{ total: bigint; uniq: bigint }[]>`
      SELECT COUNT(*)::bigint AS total,
             COUNT(DISTINCT s.mehsul_ad)::bigint AS uniq
        FROM servis_qeydleri s
       WHERE s.sahibkar_id = ${tenantId}::uuid
    `;
    return {
      total: totalRow[0] ? Number(totalRow[0].total) : 0,
      uniq: totalRow[0] ? Number(totalRow[0].uniq) : 0,
      top: rows[0] ? { mehsul_ad: rows[0].mehsul_ad, say: Number(rows[0].say) } : null,
    };
  });
}

export async function getTexnikiUsers() {
  return withTenant(() =>
    prisma.istifadeciler.findMany({
      where: { aktiv: true },
      orderBy: { ad_soyad: "asc" },
      select: { id: true, ad_soyad: true },
      take: 200,
    })
  );
}

export async function getZemanetler(): Promise<ZemanetRow[]> {
  return withTenant(async () => {
    const rows = await prisma.zemanetler.findMany({
      orderBy: { baslama_tarixi: "desc" },
      take: 500,
      include: {
        mehsullar: { select: { id: true, kod: true, barkod: true } },
        satis_sifarisleri: { select: { id: true, nomre: true } },
      },
    });

    // Per warranty, count related servis records via servis_qeydleri.satis_id link or via direct servis_id.
    const ids = rows.map((r) => r.id);
    const servisCounts = ids.length
      ? await prisma.servis_qeydleri.groupBy({
          by: ["satis_id"],
          where: { satis_id: { in: rows.map((r) => r.satis_id).filter((x): x is string => !!x) } },
          _count: { _all: true },
          _max: { qapanma_tarixi: true },
        })
      : [];
    const byMap = new Map<string, { count: number; max: Date | null }>();
    for (const c of servisCounts) {
      if (c.satis_id) byMap.set(c.satis_id, { count: c._count._all, max: c._max.qapanma_tarixi });
    }

    return rows.map((r) => {
      const counts = r.satis_id ? byMap.get(r.satis_id) : undefined;
      return {
        id: r.id,
        unikal_kod: r.unikal_kod,
        qr_token: r.qr_token,
        satis_id: r.satis_id,
        satis_nomre: r.satis_sifarisleri?.nomre ?? null,
        musteri_id: r.musteri_id,
        musteri_ad: r.musteri_ad,
        musteri_telefon: r.musteri_telefon,
        mehsul_id: r.mehsul_id ?? r.mehsullar?.id ?? null,
        mehsul_ad: r.mehsul_ad,
        mehsul_kod: r.mehsullar?.kod ?? null,
        mehsul_barkod: r.mehsullar?.barkod ?? null,
        serial_nomre: r.serial_nomre,
        imei: r.imei,
        baslama_tarixi: r.baslama_tarixi,
        bitme_tarixi: r.bitme_tarixi,
        ay_sayi: r.ay_sayi,
        status: r.status ?? "aktiv",
        satis_qiymeti: r.satis_qiymeti ? Number(r.satis_qiymeti) : null,
        servis_id: r.servis_id,
        servis_sayi: counts?.count ?? 0,
        son_temir: counts?.max ?? null,
      };
    });
  });
}

export async function getZemanetStats() {
  return withTenant(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const in30 = new Date();
    in30.setDate(now.getDate() + 30);

    const [active, expiringSoon, createdThisMonth, endingThisMonth] = await Promise.all([
      prisma.zemanetler.count({ where: { status: "aktiv", bitme_tarixi: { gte: now } } }),
      prisma.zemanetler.count({
        where: { status: "aktiv", bitme_tarixi: { gte: now, lte: in30 } },
      }),
      prisma.zemanetler.count({
        where: { yaradildi: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.zemanetler.count({
        where: { bitme_tarixi: { gte: monthStart, lt: monthEnd } },
      }),
    ]);
    return { active, expiringSoon, createdThisMonth, endingThisMonth };
  });
}

export async function getZemanetByToken(token: string) {
  const rows = await prisma.$queryRaw<{
    unikal_kod: string;
    musteri_ad: string | null;
    mehsul_ad: string | null;
    serial_nomre: string | null;
    baslama_tarixi: Date;
    bitme_tarixi: Date | null;
    status: string;
    sirket_ad: string | null;
  }[]>`
    SELECT z.unikal_kod, z.musteri_ad, z.mehsul_ad, z.serial_nomre,
           z.baslama_tarixi, z.bitme_tarixi, z.status,
           s.ad AS sirket_ad
      FROM zemanetler z
      LEFT JOIN sahibkarlar s ON s.id = z.sahibkar_id
     WHERE z.qr_token = ${token}
     LIMIT 1
  `;
  return rows[0] ?? null;
}

/* -------- Hesabat -------- */

export async function getServisHesabat() {
  return withTenant(async () => {
    // ⚠️ Raw $queryRaw tenant-extension-i ÖTÜR — sahibkar_id ƏL İLƏ lazımdır (cross-tenant sızma).
    const tenantId = requireTenant().sahibkarId;
    const now = new Date();
    const monthsBack = new Date();
    monthsBack.setMonth(now.getMonth() - 5);

    // Texniki performance
    const techRaw = await prisma.$queryRaw<{
      iscisi_id: string | null;
      ad_soyad: string | null;
      say: bigint;
      avg_gun: number | null;
      gelir: number | null;
    }[]>`
      SELECT s.servis_iscisi_id AS iscisi_id,
             i.ad_soyad,
             COUNT(*) AS say,
             AVG(EXTRACT(EPOCH FROM (s.qapanma_tarixi - s.yaradildi))/86400)::float AS avg_gun,
             COALESCE(SUM(s.musteriden_alinan), 0)::float AS gelir
        FROM servis_qeydleri s
        LEFT JOIN istifadeciler i ON i.id = s.servis_iscisi_id
       WHERE s.sahibkar_id = ${tenantId}::uuid
         AND s.qapanma_tarixi IS NOT NULL
         AND s.yaradildi IS NOT NULL
       GROUP BY s.servis_iscisi_id, i.ad_soyad
       ORDER BY say DESC
       LIMIT 20
    `;

    const tech = techRaw.map((r) => ({
      iscisi_id: r.iscisi_id,
      ad_soyad: r.ad_soyad ?? "Təyin olunmayıb",
      say: Number(r.say),
      avg_gun: r.avg_gun ? Number(r.avg_gun.toFixed(1)) : 0,
      gelir: Number(r.gelir ?? 0),
    }));

    // Top failing products
    const topFailRaw = await prisma.$queryRaw<{
      mehsul_ad: string;
      say: bigint;
      xerc: number | null;
    }[]>`
      SELECT s.mehsul_ad,
             COUNT(*) AS say,
             COALESCE(SUM(s.temir_xerci), 0)::float AS xerc
        FROM servis_qeydleri s
       WHERE s.sahibkar_id = ${tenantId}::uuid
       GROUP BY s.mehsul_ad
       ORDER BY say DESC
       LIMIT 10
    `;
    const topFail = topFailRaw.map((r) => ({
      mehsul_ad: r.mehsul_ad,
      say: Number(r.say),
      xerc: Number(r.xerc ?? 0),
    }));

    // Müştəri qayıdış (2+ servis)
    const repeatRaw = await prisma.$queryRaw<{ musteri_ad: string; musteri_telefon: string; say: bigint }[]>`
      SELECT musteri_ad, musteri_telefon, COUNT(*) AS say
        FROM servis_qeydleri
       WHERE sahibkar_id = ${tenantId}::uuid
       GROUP BY musteri_ad, musteri_telefon
      HAVING COUNT(*) > 1
       ORDER BY say DESC
       LIMIT 15
    `;
    const repeat = repeatRaw.map((r) => ({
      musteri_ad: r.musteri_ad,
      musteri_telefon: r.musteri_telefon,
      say: Number(r.say),
    }));

    // Gəlir vs xərc cəmi
    const totals = await prisma.servis_qeydleri.aggregate({
      _sum: { musteriden_alinan: true, temir_xerci: true },
    });
    const gelir = Number(totals._sum.musteriden_alinan ?? 0);
    const xerc = Number(totals._sum.temir_xerci ?? 0);
    const marja = gelir > 0 ? Math.round(((gelir - xerc) / gelir) * 1000) / 10 : 0;

    // Gecikmə (vəd tarixindən sonra qapadılan)
    const lateAgg = await prisma.$queryRaw<{ gecikme: bigint; ümum: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE qapanma_tarixi IS NOT NULL AND texmini_tehvil IS NOT NULL AND qapanma_tarixi::date > texmini_tehvil) AS gecikme,
        COUNT(*) FILTER (WHERE qapanma_tarixi IS NOT NULL AND texmini_tehvil IS NOT NULL) AS "ümum"
        FROM servis_qeydleri
       WHERE sahibkar_id = ${tenantId}::uuid
    `;
    const gecikme = lateAgg[0] ? Number(lateAgg[0].gecikme) : 0;
    const tamamlanan = lateAgg[0] ? Number(lateAgg[0].ümum) : 0;
    const gecikme_faiz = tamamlanan > 0 ? Math.round((gecikme / tamamlanan) * 1000) / 10 : 0;

    // Aylıq trend (6 ay)
    const trendRaw = await prisma.$queryRaw<{ ay: string; say: bigint; gelir: number | null }[]>`
      SELECT TO_CHAR(date_trunc('month', yaradildi), 'YYYY-MM') AS ay,
             COUNT(*) AS say,
             COALESCE(SUM(musteriden_alinan), 0)::float AS gelir
        FROM servis_qeydleri
       WHERE sahibkar_id = ${tenantId}::uuid
         AND yaradildi >= ${monthsBack}
       GROUP BY 1
       ORDER BY 1 ASC
    `;
    const trend = trendRaw.map((r) => ({
      ay: r.ay,
      say: Number(r.say),
      gelir: Number(r.gelir ?? 0),
    }));

    return { tech, topFail, repeat, gelir, xerc, marja, gecikme, gecikme_faiz, trend };
  });
}

/* -------- Yeni analitika -------- */

/** Status üzrə bottleneck — hər status-da ortalama keçən saat */
export async function getBottleneckAnalysis() {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;
    const rows = await prisma.$queryRaw<{ status: string; avg_saat: number | null; say: bigint }[]>`
      WITH transitions AS (
        SELECT t.servis_id,
               t.yeni_status AS status,
               t.yaradildi AS basla,
               LEAD(t.yaradildi) OVER (PARTITION BY t.servis_id ORDER BY t.yaradildi) AS bit
          FROM servis_status_tarixce t
          JOIN servis_qeydleri s ON s.id = t.servis_id
         WHERE s.sahibkar_id = ${tenantId}::uuid
           AND t.yeni_status <> 'qeyd'
      )
      SELECT status,
             AVG(EXTRACT(EPOCH FROM (bit - basla))/3600)::float AS avg_saat,
             COUNT(*) AS say
        FROM transitions
       WHERE bit IS NOT NULL
       GROUP BY status
       ORDER BY avg_saat DESC NULLS LAST
       LIMIT 20
    `;
    return rows.map((r) => ({
      status: r.status,
      avg_saat: r.avg_saat ? Math.round(r.avg_saat * 10) / 10 : 0,
      say: Number(r.say),
    }));
  });
}

/** Cycle time aylar üzrə — qəbul → təhvil ortalama gün */
export async function getCycleTimeByMonth() {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;
    const back = new Date();
    back.setMonth(back.getMonth() - 11);
    const rows = await prisma.$queryRaw<{ ay: string; avg_gun: number | null; say: bigint }[]>`
      SELECT TO_CHAR(date_trunc('month', yaradildi), 'YYYY-MM') AS ay,
             AVG(EXTRACT(EPOCH FROM (qapanma_tarixi - yaradildi))/86400)::float AS avg_gun,
             COUNT(*) AS say
        FROM servis_qeydleri
       WHERE sahibkar_id = ${tenantId}::uuid
         AND qapanma_tarixi IS NOT NULL
         AND yaradildi >= ${back}
       GROUP BY 1
       ORDER BY 1 ASC
    `;
    return rows.map((r) => ({
      ay: r.ay,
      avg_gun: r.avg_gun ? Math.round(r.avg_gun * 10) / 10 : 0,
      say: Number(r.say),
    }));
  });
}

/** Hər servisin xərc vs gəlir (top 30) */
export async function getCostVsRevenue() {
  return withTenant(async () => {
    const rows = await prisma.servis_qeydleri.findMany({
      where: { temir_xerci: { gt: 0 } },
      orderBy: { yaradildi: "desc" },
      take: 30,
      select: { id: true, nomre: true, temir_xerci: true, musteriden_alinan: true, mehsul_ad: true },
    });
    return rows.map((r) => ({
      id: r.id,
      nomre: r.nomre,
      mehsul_ad: r.mehsul_ad,
      xerc: Number(r.temir_xerci),
      gelir: Number(r.musteriden_alinan),
      net: Number(r.musteriden_alinan) - Number(r.temir_xerci),
    }));
  });
}

/** Defekt kategoriya üzrə paylanma */
export async function getDefektKateqDist() {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;
    const rows = await prisma.$queryRaw<{ ad: string | null; say: bigint }[]>`
      SELECT k.ad, COUNT(*) AS say
        FROM servis_qeydleri s
        LEFT JOIN servis_defekt_kateq k ON k.id = s.defekt_kateq_id
       WHERE s.sahibkar_id = ${tenantId}::uuid
       GROUP BY k.ad
       ORDER BY say DESC
       LIMIT 10
    `;
    return rows.map((r) => ({ ad: r.ad ?? "Təyin olunmayıb", say: Number(r.say) }));
  });
}

/** İlk dəfə vs təkrar müştəri */
export async function getCustomerSourceSplit() {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;
    const rows = await prisma.$queryRaw<{ ilk: bigint; tekrar: bigint }[]>`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY musteri_telefon ORDER BY yaradildi ASC) AS rn
          FROM servis_qeydleri
         WHERE sahibkar_id = ${tenantId}::uuid
      )
      SELECT COUNT(*) FILTER (WHERE rn = 1) AS ilk,
             COUNT(*) FILTER (WHERE rn > 1) AS tekrar
        FROM ranked
    `;
    const r = rows[0];
    return { ilk: Number(r?.ilk ?? 0), tekrar: Number(r?.tekrar ?? 0) };
  });
}

/** SLA üzrə pozulmuş və gecikən servislər */
export async function getSLAOverview() {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;
    const now = new Date();

    const openStatuses = ["qebul_edildi", "diaqnostikada", "teklif_gozleyir", "usta_baxir", "ehtiyat_hisse", "temir_olunur"];

    // Per status SLA pozğunluq
    const perStatus = await prisma.$queryRaw<{ status: string; say: bigint }[]>`
      SELECT status, COUNT(*) AS say
        FROM servis_qeydleri
       WHERE sahibkar_id = ${tenantId}::uuid
         AND status = ANY(${openStatuses}::text[])
         AND texmini_tehvil < ${now}
       GROUP BY status
       ORDER BY say DESC
    `;

    // Texniki üzrə gecikmə
    const perTech = await prisma.$queryRaw<{ ad_soyad: string | null; gecikme: bigint; cemi: bigint }[]>`
      SELECT i.ad_soyad,
             COUNT(*) FILTER (
               WHERE s.status = ANY(${openStatuses}::text[])
                 AND s.texmini_tehvil < ${now}
             ) AS gecikme,
             COUNT(*) AS cemi
        FROM servis_qeydleri s
        LEFT JOIN istifadeciler i ON i.id = s.servis_iscisi_id
       WHERE s.sahibkar_id = ${tenantId}::uuid
       GROUP BY i.ad_soyad
       ORDER BY gecikme DESC
       LIMIT 20
    `;

    // Top 5 ən gecikmiş açıq servislər
    const top5 = await prisma.servis_qeydleri.findMany({
      where: {
        status: { in: openStatuses },
        texmini_tehvil: { lt: now },
      },
      orderBy: { texmini_tehvil: "asc" },
      take: 5,
      select: {
        id: true,
        nomre: true,
        musteri_ad: true,
        mehsul_ad: true,
        status: true,
        texmini_tehvil: true,
        yaradildi: true,
        istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler: { select: { ad_soyad: true } },
      },
    });

    return {
      perStatus: perStatus.map((r) => ({ status: r.status, say: Number(r.say) })),
      perTech: perTech.map((r) => ({
        ad_soyad: r.ad_soyad ?? "Təyin olunmayıb",
        gecikme: Number(r.gecikme),
        cemi: Number(r.cemi),
        faiz: Number(r.cemi) > 0 ? Math.round((Number(r.gecikme) / Number(r.cemi)) * 1000) / 10 : 0,
      })),
      top5: top5.map((r) => ({
        id: r.id,
        nomre: r.nomre,
        musteri_ad: r.musteri_ad,
        mehsul_ad: r.mehsul_ad,
        status: r.status,
        texmini_tehvil: r.texmini_tehvil,
        yaradildi: r.yaradildi,
        texniki: r.istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler?.ad_soyad ?? null,
        gecikme_gun: r.texmini_tehvil
          ? Math.max(0, Math.floor((now.getTime() - new Date(r.texmini_tehvil).getTime()) / 86400000))
          : 0,
      })),
    };
  });
}

/** Saatlıq heatmap — qəbul tezliyi 7×24 */
export async function getHourlyHeatmap() {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;
    const back = new Date();
    back.setDate(back.getDate() - 90);
    const rows = await prisma.$queryRaw<{ dow: number; saat: number; say: bigint }[]>`
      SELECT EXTRACT(DOW FROM yaradildi)::int AS dow,
             EXTRACT(HOUR FROM yaradildi)::int AS saat,
             COUNT(*) AS say
        FROM servis_qeydleri
       WHERE sahibkar_id = ${tenantId}::uuid
         AND yaradildi >= ${back}
       GROUP BY 1, 2
    `;
    return rows.map((r) => ({ dow: Number(r.dow), saat: Number(r.saat), say: Number(r.say) }));
  });
}

/** Günlük qəbul/təhvil (son 30 gün) */
export async function getDailyServisCounts() {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;
    // QA-perf: inflow/outflow müstəqil idi (serial) → Promise.all + 30g chart cache 5dəq (staleness-tolerant).
    return unstable_cache(async () => {
      const back = new Date();
      back.setDate(back.getDate() - 30);
      const [inflow, outflow] = await Promise.all([
        prismaUnscoped.$queryRaw<{ gun: string; say: bigint }[]>`
          SELECT TO_CHAR(yaradildi, 'YYYY-MM-DD') AS gun, COUNT(*) AS say
            FROM servis_qeydleri
           WHERE sahibkar_id = ${tenantId}::uuid
             AND yaradildi >= ${back}
           GROUP BY 1 ORDER BY 1 ASC
        `,
        prismaUnscoped.$queryRaw<{ gun: string; say: bigint }[]>`
          SELECT TO_CHAR(qapanma_tarixi, 'YYYY-MM-DD') AS gun, COUNT(*) AS say
            FROM servis_qeydleri
           WHERE sahibkar_id = ${tenantId}::uuid
             AND qapanma_tarixi >= ${back}
             AND status = 'musteriye_tehvil'
           GROUP BY 1 ORDER BY 1 ASC
        `,
      ]);
      const map = new Map<string, { gun: string; qebul: number; tehvil: number }>();
      for (const r of inflow) map.set(r.gun, { gun: r.gun, qebul: Number(r.say), tehvil: 0 });
      for (const r of outflow) {
        const e = map.get(r.gun) ?? { gun: r.gun, qebul: 0, tehvil: 0 };
        e.tehvil = Number(r.say);
        map.set(r.gun, e);
      }
      return Array.from(map.values()).sort((a, b) => a.gun.localeCompare(b.gun));
    }, ["servis-daily-counts", tenantId], { revalidate: 300, tags: [`servis:${tenantId}`] })();
  });
}

/** Servis dashboard quick widgets — top strip */
export async function getServisDashboardWidgets() {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const openStatuses = ["qebul_edildi", "diaqnostikada", "teklif_gozleyir", "usta_baxir", "ehtiyat_hisse", "temir_olunur"];

    const [cycle, slaCount, profit, ratings] = await Promise.all([
      prisma.$queryRaw<{ avg: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM (qapanma_tarixi - yaradildi))/86400)::float AS avg
          FROM servis_qeydleri
         WHERE sahibkar_id = ${tenantId}::uuid
           AND qapanma_tarixi >= ${weekStart}
      `,
      prisma.servis_qeydleri.count({
        where: { status: { in: openStatuses }, texmini_tehvil: { lt: now } },
      }),
      prisma.servis_qeydleri.aggregate({
        where: { qapanma_tarixi: { gte: monthStart } },
        _sum: { musteriden_alinan: true, temir_xerci: true },
      }),
      // Rey-i daxili_qeyd-də [Müştəri Rəyi] tag-i ilə tap
      prisma.$queryRaw<{ avg: number | null; say: bigint }[]>`
        SELECT AVG(NULLIF((regexp_match(daxili_qeyd, 'ulduz:([1-5])'))[1]::int, 0))::float AS avg,
               COUNT(*) FILTER (WHERE daxili_qeyd ~ 'ulduz:[1-5]') AS say
          FROM servis_qeydleri
         WHERE sahibkar_id = ${tenantId}::uuid
      `,
    ]);

    const profitTotal =
      Number(profit._sum.musteriden_alinan ?? 0) - Number(profit._sum.temir_xerci ?? 0);

    return {
      cycle_avg: cycle[0]?.avg ? Math.round(Number(cycle[0].avg) * 10) / 10 : 0,
      sla_breach: slaCount,
      month_profit: profitTotal,
      rating_avg: ratings[0]?.avg ? Math.round(Number(ratings[0].avg) * 10) / 10 : 0,
      rating_count: ratings[0]?.say ? Number(ratings[0].say) : 0,
    };
  });
}

/** Bir məhsul üçün son 6 ay servis sayı (problemli-mehsullar expand) */
export async function getProductServisTrend(mehsul_id: string | null, mehsul_ad: string | null) {
  return withTenant(async () => {
    const tenantId = requireTenant().sahibkarId;
    const back = new Date();
    back.setMonth(back.getMonth() - 5);
    const matchExpr = mehsul_id
      ? Prisma.sql`mehsul_id = ${mehsul_id}::uuid`
      : Prisma.sql`mehsul_id IS NULL AND mehsul_ad = ${mehsul_ad ?? ""}`;
    const trend = await prisma.$queryRaw<{ ay: string; say: bigint }[]>`
      SELECT TO_CHAR(date_trunc('month', yaradildi), 'YYYY-MM') AS ay,
             COUNT(*) AS say
        FROM servis_qeydleri
       WHERE sahibkar_id = ${tenantId}::uuid
         AND yaradildi >= ${back}
         AND ${matchExpr}
       GROUP BY 1
       ORDER BY 1 ASC
    `;

    const matchExprS = mehsul_id
      ? Prisma.sql`s.mehsul_id = ${mehsul_id}::uuid`
      : Prisma.sql`s.mehsul_id IS NULL AND s.mehsul_ad = ${mehsul_ad ?? ""}`;
    const defekt = await prisma.$queryRaw<{ ad: string | null; say: bigint }[]>`
      SELECT k.ad, COUNT(*) AS say
        FROM servis_qeydleri s
        LEFT JOIN servis_defekt_kateq k ON k.id = s.defekt_kateq_id
       WHERE s.sahibkar_id = ${tenantId}::uuid
         AND ${matchExprS}
       GROUP BY k.ad
       ORDER BY say DESC
       LIMIT 6
    `;

    return {
      trend: trend.map((r) => ({ ay: r.ay, say: Number(r.say) })),
      defekt: defekt.map((r) => ({ ad: r.ad ?? "Təyin olunmayıb", say: Number(r.say) })),
    };
  });
}

/** Bir müştəri üçün servis tarixçəsi (musteri tab üçün) */
export async function getServisHistoryForCustomer(musteri_id: string) {
  return withTenant(async () => {
    const rows = await prisma.servis_qeydleri.findMany({
      where: { musteri_id },
      orderBy: { yaradildi: "desc" },
      take: 100,
      select: {
        id: true,
        nomre: true,
        status: true,
        mehsul_ad: true,
        problem_tesviri: true,
        temir_xerci: true,
        musteriden_alinan: true,
        yaradildi: true,
        qapanma_tarixi: true,
        texmini_tehvil: true,
      },
    });
    const total = rows.length;
    const acig = rows.filter((r) =>
      ["qebul_edildi", "diaqnostikada", "teklif_gozleyir", "usta_baxir", "ehtiyat_hisse", "temir_olunur"].includes(r.status),
    ).length;
    const ortalama_qiymet =
      rows.length > 0 ? rows.reduce((s, r) => s + Number(r.musteriden_alinan), 0) / rows.length : 0;
    const top_problem = rows[0]?.problem_tesviri ?? null;

    return {
      rows: rows.map((r) => ({
        ...r,
        temir_xerci: Number(r.temir_xerci),
        musteriden_alinan: Number(r.musteriden_alinan),
      })),
      stats: {
        total,
        acig,
        ortalama_qiymet,
        top_problem,
        loyal: total >= 5,
        son_servis: rows[0]?.yaradildi ?? null,
      },
    };
  });
}

/** Ehtiyat hissələrin siyahısı (anbar_hereketleri ref=servis) */
export async function getServisEhtiyatHisseler(servis_id: string) {
  return withTenant(async () => {
    const rows = await prisma.anbar_hereketleri.findMany({
      where: { ref_nov: "servis", ref_id: servis_id },
      orderBy: { yaradildi: "desc" },
      include: {
        mehsullar: { select: { ad: true, kod: true } },
      },
      take: 50,
    });
    // QA-orta: servis_iade reversal sətirləri "işlədilmiş hissə" kimi görünməsin —
    // həm iadə sətrini, həm də onun qaytardığı orijinal hərəkəti gizlət
    // (deleteEhtiyatHisse reversal qeydində "ref hereket: <id>" saxlayır)
    const reversedIds = new Set<string>();
    for (const r of rows) {
      if (r.nov === "servis_iade") {
        const m = r.qeyd?.match(/ref hereket:\s*(\S+)/);
        if (m) reversedIds.add(m[1]);
      }
    }
    const visible = rows.filter((r) => r.nov !== "servis_iade" && !reversedIds.has(r.id));
    return visible.map((r) => ({
      id: r.id,
      mehsul_id: r.mehsul_id,
      mehsul_ad: r.mehsullar?.ad ?? "Naməlum",
      mehsul_kod: r.mehsullar?.kod ?? null,
      miqdar: Math.abs(Number(r.miqdar)),
      qiymet: Number(r.qiymet ?? 0),
      yaradildi: r.yaradildi,
    }));
  });
}
