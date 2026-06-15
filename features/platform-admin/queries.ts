import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prismaUnscoped } from "@/lib/db/prisma";

export type PlatformKpis = {
  total_tenants: number;
  active_tenants: number;
  trial_tenants: number;
  paid_tenants: number;
  expiring_soon: number; // ≤7 days
  expired: number;
  mrr: number; // monthly recurring revenue
  arr: number; // annual recurring revenue
  total_users: number;
};

// Global scope — bir tek platform-wide cache (tenant-key yox)
export const getPlatformKpis = unstable_cache(
  async (): Promise<PlatformKpis> => {
    const now = new Date();
    const sevenDays = new Date(now);
    sevenDays.setDate(now.getDate() + 7);

    const [total, active, allAbune, expiring, expired, users] = await Promise.all([
      prismaUnscoped.sahibkarlar.count(),
      prismaUnscoped.sahibkarlar.count({ where: { status: "aktiv" } }),
      prismaUnscoped.abuneler.findMany({
        where: { status: "aktiv", bitme: { gte: now } },
        include: { abune_planlari: true },
      }),
      prismaUnscoped.abuneler.count({
        where: { status: "aktiv", bitme: { gte: now, lte: sevenDays } },
      }),
      prismaUnscoped.abuneler.count({
        where: { bitme: { lt: now } },
      }),
      prismaUnscoped.istifadeciler.count({ where: { aktiv: true } }),
    ]);

    let trial = 0;
    let paid = 0;
    let mrr = 0;
    for (const a of allAbune) {
      if (a.novu === "sinaq") trial++;
      else {
        paid++;
        mrr += Number(a.abune_planlari?.ayl_q_qiymet ?? 0);
      }
    }

    return {
      total_tenants: total,
      active_tenants: active,
      trial_tenants: trial,
      paid_tenants: paid,
      expiring_soon: expiring,
      expired,
      mrr,
      arr: mrr * 12,
      total_users: users,
    };
  },
  ["platform-kpis"],
  { revalidate: 300, tags: ["platform-admin"] },
);

export type TenantRow = {
  id: string;
  ad: string;
  email: string;
  telefon: string | null;
  status: string;
  yaradildi: Date | null;
  seh_r: string | null;
  plan_kod: string | null;
  plan_ad: string | null;
  plan_qiymet: number;
  abune_status: string | null;
  abune_novu: string | null;
  abune_bitme: Date | null;
  istifadeci_sayi: number;
  mehsul_sayi: number;
  satish_cemi: number;
};

export async function getTenants(filter?: {
  status?: string;
  q?: string;
}): Promise<TenantRow[]> {
  const rows = await prismaUnscoped.sahibkarlar.findMany({
    where: {
      ...(filter?.status && filter.status !== "any" ? { status: filter.status } : {}),
      ...(filter?.q
        ? {
            OR: [
              { ad: { contains: filter.q, mode: "insensitive" } },
              { email: { contains: filter.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { yaradildi: "desc" },
    include: {
      abuneler: {
        orderBy: { yaradildi: "desc" },
        take: 1,
        include: { abune_planlari: true },
      },
      _count: { select: { istifadeciler: true, mehsullar: true, satis_sifarisleri: true } },
    },
  });

  // Aggregate sales totals per tenant
  const salesAgg = await prismaUnscoped.satis_sifarisleri.groupBy({
    by: ["sahibkar_id"],
    where: { status: { not: "legv" }, qaralama: { not: true } },
    _sum: { son_mebleg: true },
  });
  const byTenant = new Map(salesAgg.map((r) => [r.sahibkar_id, Number(r._sum.son_mebleg ?? 0)]));

  return rows.map((t) => {
    const a = t.abuneler[0];
    return {
      id: t.id,
      ad: t.ad,
      email: t.email,
      telefon: t.telefon,
      status: t.status ?? "aktiv",
      yaradildi: t.yaradildi,
      seh_r: t.seh_r,
      plan_kod: a?.abune_planlari?.kod ?? null,
      plan_ad: a?.abune_planlari?.ad ?? null,
      plan_qiymet: a ? Number(a.abune_planlari?.ayl_q_qiymet ?? 0) : 0,
      abune_status: a?.status ?? null,
      abune_novu: a?.novu ?? null,
      abune_bitme: a?.bitme ?? null,
      istifadeci_sayi: t._count.istifadeciler,
      mehsul_sayi: t._count.mehsullar,
      satish_cemi: byTenant.get(t.id) ?? 0,
    };
  });
}

export async function getTenantDetail(id: string) {
  const tenant = await prismaUnscoped.sahibkarlar.findUnique({
    where: { id },
    include: {
      abuneler: { include: { abune_planlari: true }, orderBy: { yaradildi: "desc" } },
      _count: { select: { istifadeciler: true, mehsullar: true, satis_sifarisleri: true, filiallar: true, anbarlar: true } },
    },
  });
  return tenant;
}

export async function getExpiringTrials(daysAhead = 7) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() + daysAhead);

  const rows = await prismaUnscoped.abuneler.findMany({
    where: {
      novu: "sinaq",
      status: "aktiv",
      bitme: { gte: now, lte: cutoff },
    },
    orderBy: { bitme: "asc" },
    include: {
      sahibkarlar: { select: { id: true, ad: true, email: true, telefon: true } },
      abune_planlari: { select: { ad: true, ayl_q_qiymet: true } },
    },
  });

  return rows.map((r) => ({
    sahibkar_id: r.sahibkar_id,
    sahibkar_ad: r.sahibkarlar.ad,
    email: r.sahibkarlar.email,
    telefon: r.sahibkarlar.telefon,
    bitme: r.bitme,
    plan_ad: r.abune_planlari?.ad ?? null,
    plan_qiymet: Number(r.abune_planlari?.ayl_q_qiymet ?? 0),
    days_left: Math.ceil((new Date(r.bitme).getTime() - now.getTime()) / (24 * 3600 * 1000)),
  }));
}

export async function getRevenueByPlan() {
  const rows = await prismaUnscoped.abuneler.findMany({
    where: { status: "aktiv", novu: { not: "sinaq" } },
    include: { abune_planlari: { select: { kod: true, ad: true, ayl_q_qiymet: true } } },
  });

  const byPlan = new Map<string, { ad: string; count: number; mrr: number }>();
  for (const r of rows) {
    const kod = r.abune_planlari?.kod ?? "—";
    const cur = byPlan.get(kod) ?? { ad: r.abune_planlari?.ad ?? kod, count: 0, mrr: 0 };
    cur.count += 1;
    cur.mrr += Number(r.abune_planlari?.ayl_q_qiymet ?? 0);
    byPlan.set(kod, cur);
  }

  return Array.from(byPlan.entries()).map(([kod, v]) => ({ kod, ...v }));
}

// ── Qlobal istifadəçilər (cross-tenant) ────────────────────────────────────
export async function getGlobalUsers(filter: {
  q?: string;
  status?: string;
  tenantId?: string;
}): Promise<{
  rows: Array<{
    id: string;
    ad_soyad: string;
    email: string;
    telefon: string | null;
    rol_ad: string;
    tenant_id: string;
    tenant_ad: string;
    aktiv: boolean;
    son_giris: Date | null;
    deleted_at: Date | null;
    yaradildi: Date;
  }>;
  total: number;
  tenants: Array<{ id: string; ad: string }>;
}> {
  // status mapping per contract:
  //  "aktiv"    -> aktiv=true,  deleted_at=null
  //  "deaktiv"  -> aktiv=false
  //  "silinmis" -> deleted_at != null
  //  undefined  -> all non-deleted
  const statusWhere =
    filter.status === "aktiv"
      ? { aktiv: true, deleted_at: null }
      : filter.status === "deaktiv"
        ? { aktiv: false }
        : filter.status === "silinmis"
          ? { deleted_at: { not: null } }
          : { deleted_at: null };

  const where = {
    ...statusWhere,
    ...(filter.tenantId ? { sahibkar_id: filter.tenantId } : {}),
    ...(filter.q
      ? {
          OR: [
            { email: { contains: filter.q, mode: "insensitive" as const } },
            { ad_soyad: { contains: filter.q, mode: "insensitive" as const } },
            { telefon: { contains: filter.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total, tenants] = await Promise.all([
    prismaUnscoped.istifadeciler.findMany({
      where,
      include: {
        roles: { select: { ad: true } },
        sahibkarlar: { select: { ad: true } },
      },
      orderBy: [{ son_giris: "desc" }, { yaradildi: "desc" }],
      take: 100,
    }),
    prismaUnscoped.istifadeciler.count({ where }),
    prismaUnscoped.sahibkarlar.findMany({
      select: { id: true, ad: true },
      orderBy: { ad: "asc" },
    }),
  ]);

  return {
    rows: rows.map((u) => ({
      id: u.id,
      ad_soyad: u.ad_soyad,
      email: u.email,
      telefon: u.telefon,
      rol_ad: u.roles?.ad ?? "—",
      tenant_id: u.sahibkar_id,
      tenant_ad: u.sahibkarlar?.ad ?? "—",
      aktiv: u.aktiv ?? false,
      son_giris: u.son_giris,
      deleted_at: u.deleted_at,
      yaradildi: u.yaradildi ?? new Date(0),
    })),
    total,
    tenants,
  };
}

// ── Giriş cəhdləri (cross-tenant audit) ────────────────────────────────────
export async function getLoginAttempts(filter: {
  q?: string;
  result?: string;
  sinceHours?: number;
}): Promise<
  Array<{
    id: string;
    email: string | null;
    ip: string | null;
    ugurlu: boolean;
    user_agent: string | null;
    yaradildi: Date;
  }>
> {
  const sinceHours = filter.sinceHours && filter.sinceHours > 0 ? filter.sinceHours : 168; // default 7 gün
  const since = new Date(Date.now() - sinceHours * 3600000);

  // ⚠️ ip_adres Postgres `Inet` sütunudur — `contains`/ILIKE birbaşa İŞLƏMİR (runtime
  // xətası). Ona görə raw query + `host(ip_adres)` ilə mətnə çevirib axtarırıq.
  // Bütün dəyərlər Prisma.sql ilə parametrlənir (SQL injection yox).
  const conds: Prisma.Sql[] = [Prisma.sql`yaradildi >= ${since}`];
  if (filter.result === "ugurlu") conds.push(Prisma.sql`ugurlu = true`);
  else if (filter.result === "ugursuz") conds.push(Prisma.sql`ugurlu = false`);
  if (filter.q && filter.q.trim()) {
    const like = `%${filter.q.trim()}%`;
    conds.push(Prisma.sql`(email ILIKE ${like} OR host(ip_adres) ILIKE ${like})`);
  }

  const rows = await prismaUnscoped.$queryRaw<
    Array<{
      id: bigint;
      email: string | null;
      ip: string | null;
      ugurlu: boolean | null;
      user_agent: string | null;
      yaradildi: Date;
    }>
  >(Prisma.sql`
    SELECT id, email, host(ip_adres) AS ip, ugurlu, user_agent, yaradildi
    FROM giris_cehdleri
    WHERE ${Prisma.join(conds, " AND ")}
    ORDER BY yaradildi DESC
    LIMIT 200
  `);

  return rows.map((r) => ({
    id: String(r.id),
    email: r.email,
    ip: r.ip,
    ugurlu: r.ugurlu ?? false,
    user_agent: r.user_agent,
    yaradildi: r.yaradildi ?? since,
  }));
}

// ── Qlobal IP blokları (platform sahibi tenant-i namespace olaraq) ──────────
// GLOBAL = ip_bloklari sətirlər (sahibkar_id === SUPER_ADMIN_SAHIBKAR_ID).
export async function getGlobalIpBlocks(filter: {
  q?: string;
  activeOnly?: boolean;
}): Promise<
  Array<{
    id: number;
    ip: string;
    sebeb: string | null;
    aktiv: boolean;
    yaradildi: Date;
    bitme_tarixi: Date | null;
  }>
> {
  const globalSahibkarId = process.env.SUPER_ADMIN_SAHIBKAR_ID ?? "";

  // ⚠️ ip_adres Postgres `Inet` sütunudur — `contains`/ILIKE birbaşa İŞLƏMİR.
  // q verildikdə raw query + `host(ip_adres)` ilə mətnə çevirib axtarırıq
  // (getLoginAttempts ilə eyni nümunə). Bütün dəyərlər Prisma.sql ilə parametrlənir.
  if (filter.q && filter.q.trim()) {
    const conds: Prisma.Sql[] = [Prisma.sql`sahibkar_id = ${globalSahibkarId}::uuid`];
    if (filter.activeOnly) conds.push(Prisma.sql`aktiv = true`);
    const like = `%${filter.q.trim()}%`;
    conds.push(Prisma.sql`host(ip_adres) ILIKE ${like}`);

    const rows = await prismaUnscoped.$queryRaw<
      Array<{
        id: number;
        ip: string | null;
        sebeb: string | null;
        aktiv: boolean | null;
        yaradildi: Date;
        bitme_tarixi: Date | null;
      }>
    >(Prisma.sql`
      SELECT id, host(ip_adres) AS ip, sebeb, aktiv, yaradildi, bitme_tarixi
      FROM ip_bloklari
      WHERE ${Prisma.join(conds, " AND ")}
      ORDER BY yaradildi DESC
      LIMIT 200
    `);

    return rows.map((r) => ({
      id: Number(r.id),
      ip: String(r.ip ?? ""),
      sebeb: r.sebeb,
      aktiv: r.aktiv ?? false,
      yaradildi: r.yaradildi ?? new Date(0),
      bitme_tarixi: r.bitme_tarixi,
    }));
  }

  const rows = await prismaUnscoped.ip_bloklari.findMany({
    where: {
      sahibkar_id: globalSahibkarId,
      ...(filter.activeOnly ? { aktiv: true } : {}),
    },
    orderBy: { yaradildi: "desc" },
    take: 200,
  });

  return rows.map((r) => ({
    id: Number(r.id),
    ip: String(r.ip_adres),
    sebeb: r.sebeb,
    aktiv: r.aktiv ?? false,
    yaradildi: r.yaradildi ?? new Date(0),
    bitme_tarixi: r.bitme_tarixi,
  }));
}

// ── Tenant-üzrə modul səlahiyyəti (per-tenant module entitlement) ───────────
// Bütün aktiv modullar (modullar.aktiv=true, siralama üzrə) LEFT-join tenant-in
// sahibkar_modullar sətirlərilə birləşdirilir. Sətir yoxdursa aktiv=false.
export async function getTenantModules(
  sahibkarId: string,
): Promise<Array<{ kod: string; ad: string; aylik_qiymet: number; aktiv: boolean; bitme: Date | null }>> {
  const [modules, tenantRows] = await Promise.all([
    prismaUnscoped.modullar.findMany({
      where: { aktiv: true },
      orderBy: { siralama: "asc" },
    }),
    prismaUnscoped.sahibkar_modullar.findMany({
      where: { sahibkar_id: sahibkarId },
    }),
  ]);

  const byKod = new Map(tenantRows.map((r) => [r.modul_kod, r]));

  return modules.map((m) => {
    const row = byKod.get(m.kod);
    return {
      kod: m.kod,
      ad: m.ad,
      aylik_qiymet: Number(m.aylik_qiymet ?? 0),
      aktiv: row?.aktiv ?? false,
      bitme: row?.bitme ?? null,
    };
  });
}

// ── Plan tier → modullar daxiletmə bayrağı (plan kod → *_daxil sahəsi) ───────
// Bazada 3 plan var (baslangic/peshekar/korporativ), modullarda isə 4 tier bayrağı
// (start/business/pro/enterprise_daxil). Real planları ən uyğun bayrağa map edirik:
//   baslangic  → start_daxil
//   peshekar   → pro_daxil        (Peşəkar = Pro)
//   korporativ → enterprise_daxil (Korporativ = Enterprise)
// Kontraktdakı `business` planı da gələcəyə qarşı (fallback) saxlanılır.
// Bu map həm getTenantBilling-in `included` məntiqi, həm də applyPlanModules
// tərəfindən paylaşılır ki, ikisi eyni qaydaya əməl etsin.
export type ModulTierFlag =
  | "start_daxil"
  | "business_daxil"
  | "pro_daxil"
  | "enterprise_daxil";

export const PLAN_TIER_FLAG: Record<string, ModulTierFlag> = {
  baslangic: "start_daxil",
  business: "business_daxil",
  peshekar: "pro_daxil",
  pro: "pro_daxil",
  korporativ: "enterprise_daxil",
  enterprise: "enterprise_daxil",
};

/** Plan kod → tier bayrağı (tanınmırsa null → heç nə daxil deyil). */
export function planTierFlag(planKod: string | null | undefined): ModulTierFlag | null {
  if (!planKod) return null;
  return PLAN_TIER_FLAG[planKod.toLowerCase()] ?? null;
}

// (getAllModules + CatalogModule aşağıda — kontraktdakı struktura uyğun mövcud
//  versiya; bu fayl həm getAllModules-u, həm getTenantBilling-i ixrac edir.)

// ── Tenant-üzrə hesablaşma (plan + əlavə modullar = ödəniş) ──────────────────
// Tenant-in son abunəsini götürür (yaradildi desc). Plan tier bayrağına görə hər
// AKTİV modul üçün: included = (modulda həmin tier bayrağı true). included isə
// qiymət 0; deyilsə əlavə (add-on) kimi aylik_qiymet hesablanır. items YALNIZ
// tenant-də AKTİV olan modullar üçündür. Plan yoxdursa → plan_qiymet 0, heç nə
// daxil deyil (bütün aktiv modullar add-on).
export async function getTenantBilling(sahibkarId: string): Promise<{
  plan_kod: string | null;
  plan_ad: string | null;
  plan_qiymet: number;
  items: Array<{ kod: string; ad: string; qiymet: number; included: boolean; aktiv: boolean }>;
  addonsTotal: number;
  total: number;
}> {
  const [abuneRows, modules, tenantRows] = await Promise.all([
    prismaUnscoped.abuneler.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: { yaradildi: "desc" },
      take: 1,
      include: { abune_planlari: true },
    }),
    prismaUnscoped.modullar.findMany({
      where: { aktiv: true },
      orderBy: { siralama: "asc" },
    }),
    prismaUnscoped.sahibkar_modullar.findMany({
      where: { sahibkar_id: sahibkarId },
    }),
  ]);

  const abune = abuneRows[0] ?? null;
  const plan = abune?.abune_planlari ?? null;
  const plan_kod = plan?.kod ?? null;
  const plan_ad = plan?.ad ?? null;
  const plan_qiymet = plan ? Number(plan.ayl_q_qiymet ?? 0) : 0;
  const flag = planTierFlag(plan_kod);

  const tenantByKod = new Map(tenantRows.map((r) => [r.modul_kod, r]));

  const items: Array<{ kod: string; ad: string; qiymet: number; included: boolean; aktiv: boolean }> = [];
  let addonsTotal = 0;

  for (const m of modules) {
    const row = tenantByKod.get(m.kod);
    const aktiv = row?.aktiv ?? false;
    if (!aktiv) continue; // items YALNIZ tenant-də AKTİV modullar üçün
    const included = flag ? (m[flag] ?? false) : false;
    const aylik = Number(m.aylik_qiymet ?? 0);
    const qiymet = included ? 0 : aylik;
    if (!included) addonsTotal += aylik;
    items.push({ kod: m.kod, ad: m.ad, qiymet, included, aktiv });
  }

  return {
    plan_kod,
    plan_ad,
    plan_qiymet,
    items,
    addonsTotal,
    total: plan_qiymet + addonsTotal,
  };
}

// ── Modul kataloqu & qiymət (super-admin) ───────────────────────────────────
// Bütün modullar (siralama üzrə) — qiymət redaktəsi + plan↔modul flag-ları üçün.
export type CatalogModule = {
  kod: string;
  ad: string;
  qrup: string | null;
  aylik_qiymet: number;
  illik_qiymet: number | null;
  start_daxil: boolean;
  business_daxil: boolean;
  pro_daxil: boolean;
  enterprise_daxil: boolean;
  ayrica_alina_biler: boolean;
  aktiv: boolean;
  siralama: number;
};

export async function getAllModules(): Promise<CatalogModule[]> {
  const rows = await prismaUnscoped.modullar.findMany({
    orderBy: { siralama: "asc" },
  });

  return rows.map((m) => ({
    kod: m.kod,
    ad: m.ad,
    qrup: m.qrup ?? null,
    aylik_qiymet: Number(m.aylik_qiymet ?? 0),
    illik_qiymet:
      m.illik_qiymet === null || m.illik_qiymet === undefined ? null : Number(m.illik_qiymet),
    start_daxil: m.start_daxil ?? false,
    business_daxil: m.business_daxil ?? false,
    pro_daxil: m.pro_daxil ?? false,
    enterprise_daxil: m.enterprise_daxil ?? false,
    ayrica_alina_biler: m.ayrica_alina_biler ?? false,
    aktiv: m.aktiv ?? false,
    siralama: m.siralama ?? 100,
  }));
}

// ── Audit / fəaliyyət jurnalı (cross-tenant, guard altında) ─────────────────
// Tenant (sahibkar) və ya istifadəçi açıldıqda "nə etdiyini" göstərmək üçün
// audit_log sətirlərini sadə forma çevirir. ip_adres Postgres `Inet` sütunudur,
// Prisma onu string kimi qaytarır (filtr yox, sadə oxu).
export type AuditRow = {
  id: string;
  istifadeci_id: string | null;
  istifadeci_ad: string | null;
  emeliyyat: string;
  resurs_nov: string;
  resurs_id: string | null;
  status: string;
  yaradildi: Date | null;
  ip: string | null;
  sebeb: string | null;
};

function mapAuditRow(r: {
  id: bigint;
  istifadeci_id: string | null;
  istifadeci_ad: string | null;
  emeliyyat: string;
  resurs_nov: string;
  resurs_id: string | null;
  status: string | null;
  yaradildi: Date | null;
  ip_adres: string | null;
  sebeb: string | null;
}): AuditRow {
  return {
    id: String(r.id),
    istifadeci_id: r.istifadeci_id,
    istifadeci_ad: r.istifadeci_ad,
    emeliyyat: r.emeliyyat,
    resurs_nov: r.resurs_nov,
    resurs_id: r.resurs_id,
    status: r.status ?? "ugur",
    yaradildi: r.yaradildi,
    ip: r.ip_adres ? String(r.ip_adres) : null,
    sebeb: r.sebeb,
  };
}

const AUDIT_SELECT = {
  id: true,
  istifadeci_id: true,
  istifadeci_ad: true,
  emeliyyat: true,
  resurs_nov: true,
  resurs_id: true,
  status: true,
  yaradildi: true,
  ip_adres: true,
  sebeb: true,
} as const;

export async function getTenantAuditLog(sahibkarId: string, limit?: number): Promise<AuditRow[]> {
  const rows = await prismaUnscoped.audit_log.findMany({
    where: { sahibkar_id: sahibkarId },
    orderBy: { yaradildi: "desc" },
    take: limit ?? 50,
    select: AUDIT_SELECT,
  });
  return rows.map(mapAuditRow);
}

export async function getUserAuditLog(istifadeciId: string, limit?: number): Promise<AuditRow[]> {
  const rows = await prismaUnscoped.audit_log.findMany({
    where: { istifadeci_id: istifadeciId },
    orderBy: { yaradildi: "desc" },
    take: limit ?? 80,
    select: AUDIT_SELECT,
  });
  return rows.map(mapAuditRow);
}

// ── Qlobal istifadəçi detalı (cross-tenant) ─────────────────────────────────
export async function getGlobalUserDetail(userId: string): Promise<{
  id: string;
  ad_soyad: string;
  email: string;
  telefon: string | null;
  rol_ad: string;
  tenant_id: string;
  tenant_ad: string;
  aktiv: boolean;
  son_giris: Date | null;
  deleted_at: Date | null;
  yaradildi: Date;
} | null> {
  const u = await prismaUnscoped.istifadeciler.findUnique({
    where: { id: userId },
    include: {
      roles: { select: { ad: true } },
      sahibkarlar: { select: { ad: true } },
    },
  });
  if (!u) return null;
  return {
    id: u.id,
    ad_soyad: u.ad_soyad,
    email: u.email,
    telefon: u.telefon,
    rol_ad: u.roles?.ad ?? "—",
    tenant_id: u.sahibkar_id,
    tenant_ad: u.sahibkarlar?.ad ?? "—",
    aktiv: u.aktiv ?? false,
    son_giris: u.son_giris,
    deleted_at: u.deleted_at,
    yaradildi: u.yaradildi ?? new Date(0),
  };
}

