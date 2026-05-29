import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { Prisma } from "@prisma/client";
import { getStealthState } from "@/lib/stealth/server";

export type ContactRow = {
  id: string;
  nov: string;
  ad: string;
  voen: string | null;
  fin_kod: string | null;
  telefon: string | null;
  email: string | null;
  unvan: string | null;
  borc: number;
  aktiv: boolean;
  yaradildi: Date | null;
  son_temas: Date | null;
  qiymet_tipi: string | null;
  borc_limiti: number | null;
  menecer_ad: string | null;
  qara_siyahi: boolean;
  funnel_status: string | null;
  sirket_adi: string | null;
  sheher: string | null;
};

export type SortKey = "ad" | "borc" | "yaradildi" | "son_temas";

export type ContactFilter = {
  nov: "musteri" | "techizatci" | "her_ikisi" | "any";
  search?: string;
  borc?: "var" | "yox" | "any";
  qiymet_tipi?: string;
  status?: "aktiv" | "passiv" | "any";
  menecer_id?: string;
  olke?: string;
  sheher?: string;
  sort?: SortKey;
  dir?: "asc" | "desc";
  /** Yatmış: müştəri ki, son 90 gündür heç satış / əlaqəsi yoxdur */
  yatmis?: boolean;
  /** Doğum günü bu ay (ay nömrəsi 1-12, yalnız aktiv olanlar) */
  dogum_ay?: boolean;
  /** VIP qiymət tipi (qiymet_tipi=vip + ya tag-li VIP) */
  vip?: boolean;
  /** Qara siyahı */
  qara_siyahi?: boolean;
  /** Son 7 gündə yaradılmış kontragentlər */
  yeni?: boolean;
};

export async function getContacts(
  filter: ContactFilter,
  page = 1,
  pageSize = 50
): Promise<{
  items: ContactRow[];
  total: number;
  stats: { count: number; total_borc: number; aktiv_count: number; borclu_count: number };
}> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter.status === "passiv") where.aktiv = false;
    else if (filter.status === "any") { /* heç bir aktiv filtri tətbiq etmə */ }
    else where.aktiv = true; // default: aktiv

    if (filter.nov !== "any") {
      where.nov = filter.nov === "her_ikisi" ? "her_ikisi" : { in: [filter.nov, "her_ikisi"] };
    }
    // "Borclu" filtri — istənilən növdə borcun olması (musteri alacaq və ya təchizatçı borcu).
    if (filter.borc === "var") where.OR = [{ alacaq: { gt: 0 } }, { borc: { gt: 0 } }];
    if (filter.borc === "yox") where.AND = [{ alacaq: { lte: 0 } }, { borc: { lte: 0 } }];
    if (filter.qiymet_tipi) where.qiymet_tipi = filter.qiymet_tipi;
    if (filter.menecer_id) where.menecer_id = filter.menecer_id;
    if (filter.olke) where.olke = filter.olke;
    if (filter.sheher) where.sheher = filter.sheher;
    if (filter.vip) where.qiymet_tipi = "vip";
    if (filter.qara_siyahi) where.qara_siyahi = true;
    if (filter.yatmis) {
      const lim = new Date(); lim.setDate(lim.getDate() - 90);
      where.AND = [
        ...((where.AND ?? []) as unknown[]),
        { OR: [{ son_temas: null }, { son_temas: { lt: lim } }] },
      ];
    }
    if (filter.yeni) {
      const limYeni = new Date(); limYeni.setDate(limYeni.getDate() - 7);
      where.yaradildi = { gte: limYeni };
    }
    if (filter.dogum_ay) {
      // PostgreSQL DATE_PART funksiyası: bu ayı tutarmaq üçün raw filter
      // Prisma-nın schema-da dogum_tarixi Date olduğu üçün id-li alt-sorğu istifadə edirik
      const { sahibkarId } = requireTenant();
      const rowsBd = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND dogum_tarixi IS NOT NULL
           AND EXTRACT(MONTH FROM dogum_tarixi) = EXTRACT(MONTH FROM CURRENT_DATE)
      `.catch(() => []);
      const ids = rowsBd.map((r) => r.id);
      where.id = ids.length > 0 ? { in: ids } : { in: ["00000000-0000-0000-0000-000000000000"] };
    }

    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { ad: { contains: q, mode: "insensitive" } },
        { telefon: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { voen: { contains: q } },
        { fin_kod: { contains: q } },
        { sirket_adi: { contains: q, mode: "insensitive" } },
      ];
    }

    const sort = filter.sort ?? "yaradildi";
    const dir = filter.dir ?? "desc";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderBy: any = { [sort]: dir };

    // `where.aktiv` default-da true olduğundan, status="aktiv" və ya unset olanda
    // aktivCount === total. Ayrıca count etmək israfdır — yalnız "passiv" / "any"
    // statusda ayrı sorğu gedir.
    const aktivFilterIsAktiv = where.aktiv === true;

    const [items, total, agg, borcluCount, maybeAktivCount] = await Promise.all([
      prisma.kontragentler.findMany({
        where,
        orderBy: [orderBy, { ad: "asc" }],
        take: pageSize,
        skip: (page - 1) * pageSize,
        select: {
          id: true,
          ad: true,
          nov: true,
          voen: true,
          fin_kod: true,
          telefon: true,
          email: true,
          unvan: true,
          alacaq: true,
          borc: true,
          aktiv: true,
          yaradildi: true,
          son_temas: true,
          qiymet_tipi: true,
          borc_limiti: true,
          qara_siyahi: true,
          funnel_status: true,
          sirket_adi: true,
          sheher: true,
          istifadeciler: { select: { ad_soyad: true } },
        },
      }),
      prisma.kontragentler.count({ where }),
      // Net debt: alacaq (müştəri borcu bizə) - borc (bizim təchizatçıya borcumuz)
      prisma.kontragentler.aggregate({ where, _sum: { alacaq: true, borc: true } }),
      prisma.kontragentler.count({
        where: { ...where, OR: [{ alacaq: { gt: 0 } }, { borc: { gt: 0 } }] },
      }),
      aktivFilterIsAktiv
        ? Promise.resolve(null)
        : prisma.kontragentler.count({ where: { ...where, aktiv: true } }),
    ]);
    const aktivCount = maybeAktivCount ?? total;

    return {
      items: items.map((r) => ({
        id: r.id,
        nov: r.nov,
        ad: r.ad,
        voen: r.voen,
        fin_kod: r.fin_kod,
        telefon: r.telefon,
        email: r.email,
        unvan: r.unvan,
        // UI üçün "borc" sahəsi rolun nov-undan asılı seçilir:
        //   musteri → alacaq (bizə borc), techizatci → borc (bizim borcumuz)
        borc: Number((r.nov === "techizatci" ? r.borc : r.alacaq) ?? 0),
        aktiv: r.aktiv ?? false,
        yaradildi: r.yaradildi,
        son_temas: r.son_temas,
        qiymet_tipi: r.qiymet_tipi ?? null,
        borc_limiti:
          r.borc_limiti === null || r.borc_limiti === undefined ? null : Number(r.borc_limiti),
        menecer_ad: r.istifadeciler?.ad_soyad ?? null,
        qara_siyahi: r.qara_siyahi ?? false,
        funnel_status: r.funnel_status,
        sirket_adi: r.sirket_adi,
        sheher: r.sheher,
      })),
      total,
      stats: {
        count: total,
        total_borc: Number(agg._sum.alacaq ?? 0) - Number(agg._sum.borc ?? 0),
        aktiv_count: aktivCount,
        borclu_count: borcluCount,
      },
    };
  });
}

export async function getContactDetail(id: string) {
  return withTenant(async () => {
    return prisma.kontragentler.findUnique({
      where: { id },
      select: {
        id: true,
        ad: true,
        nov: true,
        voen: true,
        fin_kod: true,
        telefon: true,
        telefon2: true,
        email: true,
        unvan: true,
        sirket_adi: true,
        sheher: true,
        olke: true,
        valyuta: true,
        borc: true,
        borc_limiti: true,
        qiymet_tipi: true,
        menecer_id: true,
        aktiv: true,
        qara_siyahi: true,
        funnel_status: true,
        son_temas: true,
        yaradildi: true,
        qeyd: true,
        istifadeciler: { select: { id: true, ad_soyad: true } },
      },
    });
  });
}

export async function getManagers() {
  return withTenant(async () => {
    return prisma.istifadeciler.findMany({
      where: { aktiv: true },
      select: { id: true, ad_soyad: true },
      orderBy: { ad_soyad: "asc" },
    });
  });
}

/* ------------------------------------------------------------------ */
/*   DEBTORS                                                          */
/* ------------------------------------------------------------------ */

export type DebtorRow = {
  id: string;
  ad: string;
  telefon: string | null;
  borc: number;
  borc_limiti: number | null;
  son_temas: Date | null;
  son_satis_tarix: Date | null;
  son_satis_nomre: string | null;
  yas_gun: number | null;
  limit_istifade: number | null;
};

export async function getDebtorList(): Promise<{
  items: DebtorRow[];
  totals: { cemi: number; gecikmis_30: number; kritik_limit_asib: number; sayi: number };
}> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.kontragentler.findMany({
      where: { aktiv: true, alacaq: { gt: 0 } },
      orderBy: { alacaq: "desc" },
      select: {
        id: true,
        ad: true,
        telefon: true,
        alacaq: true,
        borc_limiti: true,
        son_temas: true,
      },
    });

    // For each kontragent, get latest sales order
    const ids = rows.map((r) => r.id);
    let lastSales: Map<string, { tarix: Date | null; nomre: string }> = new Map();
    if (ids.length > 0) {
      const latest = await prisma.$queryRaw<
        { musteri_id: string; tarix: Date; nomre: string }[]
      >`
        SELECT DISTINCT ON (musteri_id) musteri_id, tarix, nomre
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND musteri_id = ANY(${ids}::uuid[])
         ORDER BY musteri_id, tarix DESC
      `.catch(() => [] as { musteri_id: string; tarix: Date; nomre: string }[]);
      lastSales = new Map(latest.map((s) => [s.musteri_id, { tarix: s.tarix, nomre: s.nomre }]));
    }

    const now = Date.now();
    let cemi = 0;
    let gecikmis_30 = 0;
    let kritik_limit_asib = 0;

    const items: DebtorRow[] = rows.map((r) => {
      const borc = Number(r.alacaq ?? 0);
      const limit = r.borc_limiti === null ? null : Number(r.borc_limiti);
      const ls = lastSales.get(r.id);
      const lastDate = ls?.tarix ?? r.son_temas ?? null;
      const yas = lastDate ? Math.floor((now - lastDate.getTime()) / 86400000) : null;
      const istifade = limit && limit > 0 ? Math.round((borc / limit) * 100) : null;
      cemi += borc;
      if (yas !== null && yas > 30) gecikmis_30 += borc;
      if (limit !== null && limit > 0 && borc > limit) kritik_limit_asib += 1;
      return {
        id: r.id,
        ad: r.ad,
        telefon: r.telefon,
        borc,
        borc_limiti: limit,
        son_temas: r.son_temas,
        son_satis_tarix: ls?.tarix ?? null,
        son_satis_nomre: ls?.nomre ?? null,
        yas_gun: yas,
        limit_istifade: istifade,
      };
    });

    // Gizli mod scale tətbiqi
    const stealth = await getStealthState();
    if (stealth.aktiv && stealth.scale !== 1) {
      const s = stealth.scale;
      for (const it of items) {
        it.borc *= s;
        if (it.borc_limiti != null) it.borc_limiti *= s;
      }
      cemi *= s;
      gecikmis_30 *= s;
    }

    return { items, totals: { cemi, gecikmis_30, kritik_limit_asib, sayi: rows.length } };
  });
}

/* ------------------------------------------------------------------ */
/*   DUPLICATES                                                       */
/* ------------------------------------------------------------------ */

export type DuplicatePair = {
  kind: "telefon" | "voen" | "fin" | "email" | "ad";
  ids: string[];
  contacts: {
    id: string;
    ad: string;
    telefon: string | null;
    email: string | null;
    voen: string | null;
    fin_kod: string | null;
    borc: number;
    yaradildi: Date | null;
  }[];
  value: string;
};

function lastDigits(s: string | null | undefined, n = 9): string | null {
  if (!s) return null;
  const digits = s.replace(/\D+/g, "");
  if (digits.length < 6) return null;
  return digits.slice(-n);
}

export async function findDuplicates(): Promise<DuplicatePair[]> {
  return withTenant(async () => {
    // Çox böyük tenantlar üçün təhlükəsiz limit — duplicate axtarışı yaddaşda baş tutur,
    // 20K-dən çox kontragent olarsa ilk 20K-də qrupla; UI-da xəbərdarlıq lazım deyil
    // çünki real istifadəçi senarilərində bu limitə çatılması son dərəcə nadirdir.
    const rows = await prisma.kontragentler.findMany({
      where: { aktiv: true },
      select: {
        id: true,
        ad: true,
        telefon: true,
        email: true,
        voen: true,
        fin_kod: true,
        borc: true,
        yaradildi: true,
      },
      take: 20000,
      orderBy: { yaradildi: "desc" },
    });

    const byTel = new Map<string, typeof rows>();
    const byVoen = new Map<string, typeof rows>();
    const byFin = new Map<string, typeof rows>();
    const byEmail = new Map<string, typeof rows>();
    const byAd = new Map<string, typeof rows>();

    for (const r of rows) {
      const tel = lastDigits(r.telefon);
      if (tel) {
        const arr = byTel.get(tel) ?? [];
        arr.push(r);
        byTel.set(tel, arr);
      }
      const voen = r.voen?.trim();
      if (voen && voen.length >= 5) {
        const arr = byVoen.get(voen) ?? [];
        arr.push(r);
        byVoen.set(voen, arr);
      }
      const fin = r.fin_kod?.trim();
      if (fin && fin.length >= 5) {
        const arr = byFin.get(fin) ?? [];
        arr.push(r);
        byFin.set(fin, arr);
      }
      const email = r.email?.trim().toLowerCase();
      if (email && email.includes("@")) {
        const arr = byEmail.get(email) ?? [];
        arr.push(r);
        byEmail.set(email, arr);
      }
      const adNorm = r.ad
        .toLowerCase()
        .replace(/[^a-z0-9əğıöşüçƏĞİÖŞÜÇ]+/g, "")
        .trim();
      if (adNorm.length >= 4) {
        const arr = byAd.get(adNorm) ?? [];
        arr.push(r);
        byAd.set(adNorm, arr);
      }
    }

    const pairs: DuplicatePair[] = [];
    const pushPair = (
      kind: DuplicatePair["kind"],
      value: string,
      group: typeof rows
    ) => {
      if (group.length < 2) return;
      pairs.push({
        kind,
        value,
        ids: group.map((g) => g.id),
        contacts: group.map((g) => ({
          id: g.id,
          ad: g.ad,
          telefon: g.telefon,
          email: g.email,
          voen: g.voen,
          fin_kod: g.fin_kod,
          borc: Number(g.borc ?? 0),
          yaradildi: g.yaradildi,
        })),
      });
    };

    byTel.forEach((g, v) => pushPair("telefon", v, g));
    byVoen.forEach((g, v) => pushPair("voen", v, g));
    byFin.forEach((g, v) => pushPair("fin", v, g));
    byEmail.forEach((g, v) => pushPair("email", v, g));
    byAd.forEach((g, v) => pushPair("ad", v, g));

    // De-duplicate pairs sharing the same set of IDs (keep first encountered)
    const seen = new Set<string>();
    const result: DuplicatePair[] = [];
    for (const p of pairs) {
      const sig = [...p.ids].sort().join("|");
      if (seen.has(sig)) continue;
      seen.add(sig);
      result.push(p);
    }
    return result.sort((a, b) => b.contacts.length - a.contacts.length);
  });
}

/* ------------------------------------------------------------------ */
/*   FOLLOWUPS                                                        */
/* ------------------------------------------------------------------ */

export type FollowupRow = {
  id: number;
  kontragent_id: string;
  kontragent_ad: string;
  kontragent_telefon: string | null;
  basliq: string;
  qeyd: string | null;
  vaxt: Date;
  status: string | null;
  prioritet: string | null;
  menecer_ad: string | null;
};

export async function getFollowups(): Promise<{
  bugun: FollowupRow[];
  hefte: FollowupRow[];
  ay: FollowupRow[];
  sonra: FollowupRow[];
}> {
  return withTenant(async () => {
    const rows = await prisma.contact_followups.findMany({
      where: { status: { not: "tamamlandi" } },
      orderBy: { vaxt: "asc" },
      include: {
        kontragentler: { select: { ad: true, telefon: true } },
        istifadeciler_contact_followups_istifadeci_idToistifadeciler: {
          select: { ad_soyad: true },
        },
      },
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const monthEnd = new Date(today);
    monthEnd.setDate(today.getDate() + 31);

    const out = {
      bugun: [] as FollowupRow[],
      hefte: [] as FollowupRow[],
      ay: [] as FollowupRow[],
      sonra: [] as FollowupRow[],
    };

    for (const r of rows) {
      const row: FollowupRow = {
        id: r.id,
        kontragent_id: r.kontragent_id,
        kontragent_ad: r.kontragentler.ad,
        kontragent_telefon: r.kontragentler.telefon,
        basliq: r.basliq,
        qeyd: r.qeyd,
        vaxt: r.vaxt,
        status: r.status,
        prioritet: r.prioritet,
        menecer_ad:
          r.istifadeciler_contact_followups_istifadeci_idToistifadeciler?.ad_soyad ?? null,
      };
      const t = r.vaxt.getTime();
      if (t < tomorrow.getTime()) out.bugun.push(row);
      else if (t < weekEnd.getTime()) out.hefte.push(row);
      else if (t < monthEnd.getTime()) out.ay.push(row);
      else out.sonra.push(row);
    }
    return out;
  });
}

/* ------------------------------------------------------------------ */
/*   DETAIL TABS — NOTES / COMMUNICATIONS / FOLLOWUPS / TASKS         */
/* ------------------------------------------------------------------ */

export async function getContactNotes(id: string) {
  return withTenant(async () => {
    return prisma.musteri_qeydleri.findMany({
      where: { musteri_id: id },
      orderBy: { yaradildi: "desc" },
      take: 100,
      include: { istifadeciler: { select: { ad_soyad: true } } },
    });
  });
}

export async function getContactCommunications(id: string) {
  return withTenant(async () => {
    return prisma.contact_communications.findMany({
      where: { kontragent_id: id },
      orderBy: { yaradildi: "desc" },
      take: 100,
      include: { istifadeciler: { select: { ad_soyad: true } } },
    });
  });
}

export async function getContactFollowups(id: string) {
  return withTenant(async () => {
    return prisma.contact_followups.findMany({
      where: { kontragent_id: id },
      orderBy: { vaxt: "desc" },
      take: 50,
      include: {
        istifadeciler_contact_followups_istifadeci_idToistifadeciler: {
          select: { ad_soyad: true },
        },
      },
    });
  });
}

export async function getContactFinanceOps(id: string) {
  return withTenant(async () => {
    return prisma.finance_operations.findMany({
      where: { kontragent_id: id, status: "aktiv" },
      orderBy: { tarix: "desc" },
      take: 60,
    });
  });
}

export async function getContactTags(id: string) {
  return withTenant(async () => {
    return prisma.contact_tag_links.findMany({
      where: { kontragent_id: id },
      include: { contact_tags: true },
    });
  });
}

export async function getAvailableTags() {
  return withTenant(async () => {
    return prisma.contact_tags.findMany({ orderBy: { ad: "asc" } });
  });
}

/* ------------------------------------------------------------------ */
/*   REPORTS                                                          */
/* ------------------------------------------------------------------ */

export type ReportData = {
  top_musteri: { id: string; ad: string; ltv: number; sayi: number }[];
  yeni_musteri_aylar: { month: string; count: number }[];
  borc_buckets: { label: string; count: number; sum: number }[];
  status_split: { aktiv: number; passiv: number };
  seher_dist: { sheher: string; count: number }[];
};

export async function getElaqeReport(): Promise<ReportData> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const [topRaw, monthsRaw, allDebtor, statusRaw, seherRaw] = await Promise.all([
      prisma.$queryRaw<{ musteri_id: string; ad: string; ltv: Prisma.Decimal; sayi: bigint }[]>`
        SELECT s.musteri_id, k.ad, COALESCE(SUM(s.son_mebleg), 0) AS ltv, COUNT(*)::bigint AS sayi
          FROM satis_sifarisleri s
          JOIN kontragentler k ON k.id = s.musteri_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid AND s.status <> 'legv'
         GROUP BY s.musteri_id, k.ad
         ORDER BY ltv DESC
         LIMIT 10
      `.catch(() => []),
      prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT TO_CHAR(yaradildi, 'YYYY-MM') AS month, COUNT(*)::bigint AS count
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND yaradildi >= NOW() - INTERVAL '12 months'
         GROUP BY 1
         ORDER BY 1
      `.catch(() => []),
      prisma.kontragentler.findMany({
        where: { aktiv: true, alacaq: { gt: 0 } },
        select: { alacaq: true, son_temas: true },
        take: 5000,
      }),
      prisma.$queryRaw<{ aktiv: boolean; count: bigint }[]>`
        SELECT aktiv, COUNT(*)::bigint AS count
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
         GROUP BY aktiv
      `.catch(() => []),
      prisma.$queryRaw<{ sheher: string; count: bigint }[]>`
        SELECT COALESCE(sheher, 'Bilinmir') AS sheher, COUNT(*)::bigint AS count
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid AND aktiv = true
         GROUP BY 1
         ORDER BY 2 DESC
         LIMIT 10
      `.catch(() => []),
    ]);

    const now = Date.now();
    const buckets = { "0-30": { count: 0, sum: 0 }, "31-60": { count: 0, sum: 0 }, "61-90": { count: 0, sum: 0 }, "90+": { count: 0, sum: 0 } };
    for (const r of allDebtor) {
      const borc = Number(r.alacaq ?? 0);
      const days = r.son_temas ? Math.floor((now - r.son_temas.getTime()) / 86400000) : 999;
      let key: keyof typeof buckets = "0-30";
      if (days > 90) key = "90+";
      else if (days > 60) key = "61-90";
      else if (days > 30) key = "31-60";
      buckets[key].count += 1;
      buckets[key].sum += borc;
    }

    let aktiv = 0;
    let passiv = 0;
    for (const r of statusRaw) {
      if (r.aktiv) aktiv = Number(r.count);
      else passiv = Number(r.count);
    }

    return {
      top_musteri: topRaw.map((r) => ({
        id: r.musteri_id,
        ad: r.ad,
        ltv: Number(r.ltv),
        sayi: Number(r.sayi),
      })),
      yeni_musteri_aylar: monthsRaw.map((r) => ({ month: r.month, count: Number(r.count) })),
      borc_buckets: Object.entries(buckets).map(([label, v]) => ({ label, ...v })),
      status_split: { aktiv, passiv },
      seher_dist: seherRaw.map((r) => ({ sheher: r.sheher, count: Number(r.count) })),
    };
  });
}

/* ------------------------------------------------------------------ */
/*   ELAQE DASHBOARD — Top/Risk müştərilər + KPI-lar                   */
/* ------------------------------------------------------------------ */

export type ElaqeDashboard = {
  cemi: number;
  musteri: number;
  techizatci: number;
  qara_siyahi: number;
  borclu_say: number;
  borc_cemi: number;
  gec_borc_say: number;
  followup_bugun: number;
  followup_gecikmis: number;
  followup_acig: number;
  lead_aktiv: number;
  dogum_bu_ay: number;
  yatmis_say: number;
  top_musteri: { id: string; ad: string; satis_say: number; dovriyye: number }[];
  risk_musteri: { id: string; ad: string; borc: number; gun: number }[];
};

export async function getElaqeDashboard(): Promise<ElaqeDashboard> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const thisMonth = now.getMonth() + 1; // 1-12
    const yatmisLimit = new Date(); yatmisLimit.setDate(yatmisLimit.getDate() - 90);

    const [
      cemi,
      musteri,
      techizatci,
      qaraSiyahi,
      borcluList,
      followupBugun,
      followupGecikmis,
      followupAcig,
      leadAktiv,
      topRaw,
      riskRaw,
      dogumRaw,
    ] = await Promise.all([
      prisma.kontragentler.count({ where: { aktiv: true } }),
      prisma.kontragentler.count({ where: { aktiv: true, nov: { in: ["musteri", "her_ikisi"] } } }),
      prisma.kontragentler.count({ where: { aktiv: true, nov: { in: ["techizatci", "her_ikisi"] } } }),
      prisma.kontragentler.count({ where: { qara_siyahi: true } }),
      prisma.kontragentler.findMany({
        where: { aktiv: true, alacaq: { gt: 0 } },
        select: { alacaq: true, son_temas: true, borc_limiti: true },
      }),
      prisma.contact_followups.count({
        where: { status: "gozleyir", vaxt: { gte: today, lt: tomorrow } },
      }),
      prisma.contact_followups.count({
        where: { status: "gozleyir", vaxt: { lt: today } },
      }),
      prisma.contact_followups.count({ where: { status: "gozleyir" } }),
      prisma.leads.count({ where: { status: { notIn: ["bagh_legv", "bagh_qazand", "qazand"] } } }).catch(() => 0),
      prisma.$queryRaw<{ musteri_id: string; ad: string; sayi: bigint; dovriyye: Prisma.Decimal }[]>`
        SELECT s.musteri_id, k.ad, COUNT(*)::bigint AS sayi, COALESCE(SUM(s.son_mebleg), 0) AS dovriyye
          FROM satis_sifarisleri s
          JOIN kontragentler k ON k.id = s.musteri_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid
           AND s.status <> 'legv'
           AND s.tarix >= NOW() - INTERVAL '90 days'
         GROUP BY s.musteri_id, k.ad
         ORDER BY dovriyye DESC
         LIMIT 8
      `.catch(() => []),
      prisma.kontragentler.findMany({
        where: { aktiv: true, alacaq: { gt: 0 } },
        select: { id: true, ad: true, alacaq: true, son_temas: true },
        orderBy: { alacaq: "desc" },
        take: 30,
      }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND aktiv = true
           AND dogum_tarixi IS NOT NULL
           AND EXTRACT(MONTH FROM dogum_tarixi) = ${thisMonth}
      `.catch(() => [{ count: 0n }]),
    ]);

    const yatmisCount = await prisma.kontragentler.count({
      where: {
        aktiv: true,
        nov: { in: ["musteri", "her_ikisi"] },
        OR: [
          { son_temas: null },
          { son_temas: { lt: yatmisLimit } },
        ],
      },
    });

    const borc_cemi = borcluList.reduce((s, r) => s + Number(r.alacaq ?? 0), 0);
    let gec_borc_say = 0;
    const nowTs = Date.now();
    for (const r of borcluList) {
      const days = r.son_temas ? Math.floor((nowTs - r.son_temas.getTime()) / 86400000) : 999;
      if (days > 30) gec_borc_say++;
    }

    // Filter risk customers: only those whose son_temas > 30 days
    const risk_musteri = riskRaw
      .map((r) => {
        const gun = r.son_temas ? Math.floor((nowTs - r.son_temas.getTime()) / 86400000) : 999;
        return { id: r.id, ad: r.ad, borc: Number(r.alacaq ?? 0), gun };
      })
      .filter((r) => r.gun > 30)
      .sort((a, b) => b.borc - a.borc)
      .slice(0, 8);

    return {
      cemi,
      musteri,
      techizatci,
      qara_siyahi: qaraSiyahi,
      borclu_say: borcluList.length,
      borc_cemi,
      gec_borc_say,
      followup_bugun: followupBugun,
      followup_gecikmis: followupGecikmis,
      followup_acig: followupAcig,
      lead_aktiv: leadAktiv,
      dogum_bu_ay: Number(dogumRaw[0]?.count ?? 0),
      yatmis_say: yatmisCount,
      top_musteri: topRaw.map((r) => ({
        id: r.musteri_id,
        ad: r.ad,
        satis_say: Number(r.sayi),
        dovriyye: Number(r.dovriyye),
      })),
      risk_musteri,
    };
  });
}

/* ------------------------------------------------------------------ */
/*   KREDITOR — Bizim təchizatçılara borcumuz                         */
/* ------------------------------------------------------------------ */

export type CreditorRow = {
  id: string;
  ad: string;
  telefon: string | null;
  voen: string | null;
  borc: number; // mütləq qiymət (mənfi balansın absolyutu)
  son_temas: Date | null;
  yas_gun: number | null;
  son_alis_nomre: string | null;
  son_alis_tarix: Date | null;
};

export async function getCreditorList(): Promise<{
  items: CreditorRow[];
  totals: { cemi: number; sayi: number; gecikmis_30: number };
}> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    // Kreditor — biz təchizatçıya borcluyuq (borc > 0 yeni modeldə).
    const rows = await prisma.kontragentler.findMany({
      where: { aktiv: true, borc: { gt: 0 }, nov: { in: ["techizatci", "her_ikisi"] } },
      orderBy: { borc: "desc" },
      select: { id: true, ad: true, telefon: true, voen: true, borc: true, son_temas: true },
    });
    const ids = rows.map((r) => r.id);
    let lastBuy: Map<string, { tarix: Date | null; nomre: string }> = new Map();
    if (ids.length > 0) {
      const latest = await prisma.$queryRaw<
        { techiazatci_id: string; tarix: Date; nomre: string }[]
      >`
        SELECT DISTINCT ON (techiazatci_id) techiazatci_id, tarix, nomre
          FROM alis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND techiazatci_id = ANY(${ids}::uuid[])
         ORDER BY techiazatci_id, tarix DESC
      `.catch(() => []);
      lastBuy = new Map(latest.map((s) => [s.techiazatci_id, { tarix: s.tarix, nomre: s.nomre }]));
    }
    const nowTs = Date.now();
    let cemi = 0;
    let gecikmis_30 = 0;
    const items: CreditorRow[] = rows.map((r) => {
      const borc = Number(r.borc ?? 0);
      const ls = lastBuy.get(r.id);
      const lastDate = ls?.tarix ?? r.son_temas ?? null;
      const yas = lastDate ? Math.floor((nowTs - lastDate.getTime()) / 86400000) : null;
      cemi += borc;
      if (yas !== null && yas > 30) gecikmis_30 += borc;
      return {
        id: r.id,
        ad: r.ad,
        telefon: r.telefon,
        voen: r.voen,
        borc,
        son_temas: r.son_temas,
        yas_gun: yas,
        son_alis_nomre: ls?.nomre ?? null,
        son_alis_tarix: ls?.tarix ?? null,
      };
    });
    return { items, totals: { cemi, sayi: rows.length, gecikmis_30 } };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Segment counts — sums by qiymet_tipi within a contact type.
 * Used to label segment tabs on müştərilər / təchizatçılar pages.
 * ────────────────────────────────────────────────────────────────────────── */

export type SegmentCount = { qiymet_tipi: string; count: number; borc_cemi: number };
export type SegmentCountsResult = {
  total: number;
  borc_total: number;
  borclu_say: number;
  segments: SegmentCount[];
  countries: { olke: string; count: number }[];
  cities: { sheher: string; count: number }[];
};

export async function getContactSegmentCounts(
  nov: "musteri" | "techizatci" | "her_ikisi"
): Promise<SegmentCountsResult> {
  return withTenant(async () => {
    const novList: string[] =
      nov === "her_ikisi"
        ? ["musteri", "techizatci", "her_ikisi"]
        : nov === "musteri"
        ? ["musteri", "her_ikisi"]
        : ["techizatci", "her_ikisi"];

    const [segments, countries, cities, totalAgg, borcluCount] = await Promise.all([
      prisma.kontragentler.groupBy({
        by: ["qiymet_tipi"],
        where: { aktiv: true, nov: { in: novList } },
        _count: { _all: true },
        _sum: { borc: true },
      }),
      prisma.kontragentler.groupBy({
        by: ["olke"],
        where: { aktiv: true, nov: { in: novList }, olke: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { olke: "desc" } },
        take: 10,
      }).catch(() => [] as { olke: string | null; _count: { _all: number } }[]),
      prisma.kontragentler.groupBy({
        by: ["sheher"],
        where: { aktiv: true, nov: { in: novList }, sheher: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { sheher: "desc" } },
        take: 10,
      }).catch(() => [] as { sheher: string | null; _count: { _all: number } }[]),
      prisma.kontragentler.aggregate({
        where: { aktiv: true, nov: { in: novList } },
        _count: { _all: true },
        _sum: { alacaq: true, borc: true },
      }),
      prisma.kontragentler.count({
        where: { aktiv: true, nov: { in: novList }, OR: [{ alacaq: { gt: 0 } }, { borc: { gt: 0 } }] },
      }),
    ]);

    return {
      total: totalAgg._count._all,
      borc_total: Number(totalAgg._sum.alacaq ?? 0) - Number(totalAgg._sum.borc ?? 0),
      borclu_say: borcluCount,
      segments: segments.map((s) => ({
        qiymet_tipi: s.qiymet_tipi ?? "adi",
        count: s._count._all,
        borc_cemi: Number(s._sum.borc ?? 0),
      })),
      countries: countries
        .filter((c) => c.olke)
        .map((c) => ({ olke: c.olke!, count: c._count._all })),
      cities: cities
        .filter((c) => c.sheher)
        .map((c) => ({ sheher: c.sheher!, count: c._count._all })),
    };
  });
}
