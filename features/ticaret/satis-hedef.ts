import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const QRUP = "ticaret";
const ACAR_AYLIK = "satis_aylik_hedef";
const ACAR_ISCI_PREFIX = "satis_hedef_isci:"; // + isci_id → həmin satıcının aylıq hədəfi

export type SalesTargetProgress = {
  hedef_ay: number;
  satis_ay: number;
  satis_bugun: number;
  faiz: number;
  proportional_faiz: number;
  bugune_kimi_hedef: number;
  ay_gun_say: number;
  bugun_gun: number;
};

/**
 * Read the configured monthly sales target (AZN) for this tenant.
 * Returns 0 when not configured.
 */
export async function getMonthlyTarget(): Promise<number> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR_AYLIK } },
    });
    if (!row?.deyer) return 0;
    const n = Number(row.deyer);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
}

/**
 * Save the monthly sales target.
 */
export async function setMonthlyTarget(value: number): Promise<void> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    await prisma.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR_AYLIK } },
      update: { deyer: String(value), yenilendi: new Date() },
      create: {
        sahibkar_id: sahibkarId,
        qrup: QRUP,
        acar: ACAR_AYLIK,
        deyer: String(value),
        nov: "decimal",
        tesvir: "Aylık satış hədəfi (AZN)",
      },
    });
  });
}

/**
 * Compute progress against the monthly target.
 */
export async function getTargetProgress(): Promise<SalesTargetProgress> {
  return withTenant(async () => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const ayGunSay = Math.round((nextMonth.getTime() - monthStart.getTime()) / 86400000);
    const bugunGun = today.getDate();

    const [hedefAy, satisAyAgg, satisBugunAgg] = await Promise.all([
      getMonthlyTarget(),
      prisma.satis_sifarisleri.aggregate({
        where: {
          tarix: { gte: monthStart },
          qaralama: { not: true },
          // QA: qaytarılmış satışlar hədəf-icrasına daxil olmamalıdır (yalnız 'legv' çıxılırdı).
          status: { notIn: ["legv", "qaytarilib"] },
        },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: {
          tarix: { gte: today },
          qaralama: { not: true },
          status: { notIn: ["legv", "qaytarilib"] },
        },
        _sum: { son_mebleg: true },
      }),
    ]);

    const satisAy = Number(satisAyAgg._sum.son_mebleg ?? 0);
    const satisBugun = Number(satisBugunAgg._sum.son_mebleg ?? 0);
    const bugunKimiHedef = hedefAy > 0 ? (hedefAy / ayGunSay) * bugunGun : 0;
    const faiz = hedefAy > 0 ? Math.round((satisAy / hedefAy) * 100) : 0;
    const proportionalFaiz = bugunKimiHedef > 0 ? Math.round((satisAy / bugunKimiHedef) * 100) : 0;

    return {
      hedef_ay: hedefAy,
      satis_ay: satisAy,
      satis_bugun: satisBugun,
      faiz,
      proportional_faiz: proportionalFaiz,
      bugune_kimi_hedef: bugunKimiHedef,
      ay_gun_say: ayGunSay,
      bugun_gun: bugunGun,
    };
  });
}

// ============================================================
// SATIŞ HƏDƏF DASHBOARD (yeni — roadmap #9 davamı)
// ============================================================

export type SalespersonTarget = {
  isci_id: string;
  ad: string;
  hedef: number;      // aylıq hədəf (0 = təyin olunmayıb)
  faktiki: number;    // bu ay faktiki satış
  sifaris: number;    // bu ay sifariş sayı
  faiz: number;       // hədəfə görə % (hədəf 0-dırsa 0)
  pay_faiz: number;   // ümumi satışdakı payı %
};

export type SalesTargetDashboard = {
  hedef_ay: number;
  faktiki_ay: number;
  faiz: number;                 // hədəfin neçə %-i
  proportional_faiz: number;    // günə görə gözlənilən tempə görə %
  bugune_kimi_hedef: number;    // bu günə qədər olmalı olan (proporsional)
  proyeksiya: number;           // cari tempə görə ay-sonu proqnozu
  proyeksiya_faiz: number;      // proqnozun hədəfə görə %-i
  ay_gun_say: number;
  bugun_gun: number;
  qalan_gun: number;
  gunluk_lazim: number;         // hədəfə çatmaq üçün qalan günlərdə günlük lazım
  status: "onunde" | "geride" | "hedefsiz"; // tempdən öndə/geridə
  saticilar: SalespersonTarget[];
};

/** Bütün satıcıların aylıq hədəflərini oxu (ayarlar-dan). */
async function getSalespersonTargetsMap(sahibkarId: string): Promise<Map<string, number>> {
  const rows = await prisma.ayarlar.findMany({
    where: { sahibkar_id: sahibkarId, qrup: QRUP, acar: { startsWith: ACAR_ISCI_PREFIX } },
    select: { acar: true, deyer: true },
  });
  const m = new Map<string, number>();
  for (const r of rows) {
    const id = r.acar.slice(ACAR_ISCI_PREFIX.length);
    const n = Number(r.deyer);
    if (id && Number.isFinite(n) && n > 0) m.set(id, n);
  }
  return m;
}

/** Bir satıcının aylıq hədəfini təyin et (0 → sil). */
export async function setSalespersonTarget(isciId: string, value: number): Promise<void> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const { ensurePermission } = await import("@/lib/auth/role-check").then((m) => ({ ensurePermission: m.permGate }));
    const g = ensurePermission("satis.idare", "komissiya.idare", "ayarlar.idare");
    if (!g.ok) throw new Error(g.error);
    const acar = ACAR_ISCI_PREFIX + isciId;
    if (!(value > 0)) {
      await prisma.ayarlar.deleteMany({ where: { sahibkar_id: sahibkarId, qrup: QRUP, acar } });
      return;
    }
    await prisma.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar } },
      update: { deyer: String(value), yenilendi: new Date() },
      create: { sahibkar_id: sahibkarId, qrup: QRUP, acar, deyer: String(value), nov: "decimal", tesvir: "Satıcı aylıq hədəfi" },
    });
  });
}

/** Tam satış-hədəf dashboard: ümumi + projeksiya + satıcı-üzrə bölgü. */
export async function getSalesTargetDashboard(): Promise<SalesTargetDashboard> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const ayGunSay = Math.round((nextMonth.getTime() - monthStart.getTime()) / 86400000);
    const bugunGun = today.getDate();
    const qalanGun = Math.max(0, ayGunSay - bugunGun);

    const [hedefAy, ayAgg, perSaticiRows, targetsMap] = await Promise.all([
      getMonthlyTarget(),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: monthStart }, qaralama: { not: true }, status: { notIn: ["legv", "qaytarilib"] } },
        _sum: { son_mebleg: true },
      }),
      prisma.$queryRaw<Array<{ isci_id: string; ad: string; faktiki: number; sifaris: number }>>`
        SELECT u.id::text AS isci_id, u.ad_soyad AS ad,
               COALESCE(SUM(ss.son_mebleg), 0)::float AS faktiki,
               COUNT(ss.id)::int AS sifaris
          FROM satis_sifarisleri ss
          JOIN istifadeciler u ON u.id = ss.satis_meneceri_id
         WHERE ss.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix >= ${monthStart}
           AND ss.status NOT IN ('legv','qaytarilib')
           AND COALESCE(ss.qaralama, false) = false
         GROUP BY u.id, u.ad_soyad
         ORDER BY faktiki DESC
      `,
      getSalespersonTargetsMap(sahibkarId),
    ]);

    const faktikiAy = Number(ayAgg._sum.son_mebleg ?? 0);
    const bugunKimiHedef = hedefAy > 0 ? (hedefAy / ayGunSay) * bugunGun : 0;
    const faiz = hedefAy > 0 ? Math.round((faktikiAy / hedefAy) * 100) : 0;
    const proportionalFaiz = bugunKimiHedef > 0 ? Math.round((faktikiAy / bugunKimiHedef) * 100) : 0;
    const gunlukOrta = bugunGun > 0 ? faktikiAy / bugunGun : 0;
    const proyeksiya = Math.round(gunlukOrta * ayGunSay);
    const proyeksiyaFaiz = hedefAy > 0 ? Math.round((proyeksiya / hedefAy) * 100) : 0;
    const gunlukLazim = qalanGun > 0 && hedefAy > faktikiAy ? Math.round((hedefAy - faktikiAy) / qalanGun) : 0;
    const status: SalesTargetDashboard["status"] = hedefAy <= 0 ? "hedefsiz" : proportionalFaiz >= 100 ? "onunde" : "geride";

    const saticilar: SalespersonTarget[] = perSaticiRows.map((r) => {
      const hedef = targetsMap.get(r.isci_id) ?? 0;
      const faktiki = Number(r.faktiki);
      return {
        isci_id: r.isci_id, ad: r.ad,
        hedef, faktiki, sifaris: Number(r.sifaris),
        faiz: hedef > 0 ? Math.round((faktiki / hedef) * 100) : 0,
        pay_faiz: faktikiAy > 0 ? Math.round((faktiki / faktikiAy) * 100) : 0,
      };
    });

    return {
      hedef_ay: hedefAy, faktiki_ay: faktikiAy, faiz, proportional_faiz: proportionalFaiz,
      bugune_kimi_hedef: Math.round(bugunKimiHedef), proyeksiya, proyeksiya_faiz: proyeksiyaFaiz,
      ay_gun_say: ayGunSay, bugun_gun: bugunGun, qalan_gun: qalanGun, gunluk_lazim: gunlukLazim,
      status, saticilar,
    };
  });
}
