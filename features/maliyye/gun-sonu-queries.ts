import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type GunSonuToday = {
  tarix: string;
  satish_cem: number;
  qaytarma_cem: number;
  xerc_cem: number;
  kassa_acig_say: number;
  kassa_acilis_cem: number;
  net: number;
  baglanmis_var: boolean;
};

export async function getGunSonuToday(): Promise<GunSonuToday> {
  return withTenant(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isoTarix = today.toISOString().slice(0, 10);

    const [salesAgg, expenseAgg, kassaAcig, baglanmis] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: today }, qaralama: { not: true } },
        _sum: { son_mebleg: true, odenilmis: true },
        _count: { _all: true },
      }),
      prisma.xercl_r.aggregate({
        where: { tarix: { gte: today }, legv_de: null },
        _sum: { mebleg: true },
      }),
      prisma.kassalar.aggregate({
        where: { status: "acig" },
        _sum: { acilis_qaligi: true },
        _count: { _all: true },
      }),
      prisma.gun_sonu
        .findFirst({ where: { tarix: today }, select: { id: true } })
        .catch(() => null),
    ]);

    const satisCem = Number(salesAgg._sum.odenilmis ?? 0);
    const xercCem = Number(expenseAgg._sum.mebleg ?? 0);

    return {
      tarix: isoTarix,
      satish_cem: satisCem,
      qaytarma_cem: 0,
      xerc_cem: xercCem,
      kassa_acig_say: kassaAcig._count._all,
      kassa_acilis_cem: Number(kassaAcig._sum.acilis_qaligi ?? 0),
      net: satisCem - xercCem,
      baglanmis_var: Boolean(baglanmis),
    };
  });
}

export type GunSonuRow = {
  id: number;
  tarix: Date;
  filial_ad: string | null;
  status: string;
  satish_cem: number;
  xerc_cem: number;
  menfeet: number;
  kassa_qaliq: number;
  kassa_ferq: number;
  problem_say: number;
  baglayan_ad: string | null;
  bagh_tarix: Date | null;
  qeyd: string | null;
};

export type GunSonuCheck = {
  key: string;
  baslıq: string;
  status: "ok" | "warn" | "error";
  detay: string;
  fix_href?: string;
  fix_label?: string;
};

/**
 * Pre-close checklist for end-of-day. Each row returns ok/warn/error so the UI
 * can prevent close or surface "Düzəlt" links.
 */
export async function getGunSonuChecks(): Promise<GunSonuCheck[]> {
  return withTenant(async () => {
    // ⚠️ Raw $queryRaw tenant-extension-i ÖTÜR — sahibkar_id ƏL İLƏ lazımdır.
    const { sahibkarId } = requireTenant();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const checks: GunSonuCheck[] = [];

    // 1. Open kassa
    try {
      const acilKassaSay = await prisma.kassalar.count({ where: { status: "acig" } });
      checks.push({
        key: "kassa_acig",
        baslıq: "Kassa açıqdır",
        status: acilKassaSay === 0 ? "ok" : "warn",
        detay: acilKassaSay === 0 ? "Bütün kassalar bağlanıb" : `${acilKassaSay} açıq kassa var`,
        fix_href: acilKassaSay > 0 ? "/maliyye/kassalar" : undefined,
        fix_label: acilKassaSay > 0 ? "Kassanı bağla" : undefined,
      });
    } catch {
      checks.push({ key: "kassa_acig", baslıq: "Kassa açıqdır", status: "warn", detay: "Status yoxlanılmadı" });
    }

    // 2. Unpaid sales today (odenilmis < son_mebleg)
    try {
      const unpaidRows = await prisma.$queryRaw<{ c: bigint; qaliq: number }[]>`
        SELECT COUNT(*)::bigint AS c,
               COALESCE(SUM(COALESCE(son_mebleg,0) - COALESCE(odenilmis,0)), 0)::float AS qaliq
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix >= ${today} AND tarix < ${tomorrow}
           AND COALESCE(qaralama, false) = FALSE
           AND COALESCE(status, '') <> 'legv'
           AND COALESCE(odenilmis, 0) < COALESCE(son_mebleg, 0)
      `;
      const count = Number(unpaidRows[0]?.c ?? 0);
      const sum = Number(unpaidRows[0]?.qaliq ?? 0);
      checks.push({
        key: "odenilmemis",
        baslıq: "Ödənilməyən satış",
        status: count === 0 ? "ok" : "warn",
        detay: count === 0 ? "Bütün satışlar ödənilib" : `${count} sifariş — qalıq ${sum.toFixed(2)} ₼`,
        fix_href: count > 0 ? "/maliyye/debitor" : undefined,
        fix_label: count > 0 ? "Debitorda bax" : undefined,
      });
    } catch {
      checks.push({ key: "odenilmemis", baslıq: "Ödənilməyən satış", status: "warn", detay: "Yoxlanmadı" });
    }

    // 3. Below-min stock
    try {
      const lowStock = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c
          FROM mehsullar m
         WHERE m.sahibkar_id = ${sahibkarId}::uuid
           AND m.aktiv = TRUE
           AND m.min_stok IS NOT NULL
           AND COALESCE((SELECT SUM(miqdar) FROM stok WHERE mehsul_id = m.id AND sahibkar_id = ${sahibkarId}::uuid), 0) <= m.min_stok
      `.catch(() => [{ c: 0n }]);
      const c = Number(lowStock[0]?.c ?? 0);
      checks.push({
        key: "stok_alt",
        baslıq: "Stok-altı məhsullar",
        status: c === 0 ? "ok" : c > 10 ? "error" : "warn",
        detay: c === 0 ? "Bütün stok kafi səviyyədədir" : `${c} məhsul min_stok altındadır`,
        fix_href: c > 0 ? "/hesabatlar/stok" : undefined,
        fix_label: c > 0 ? "Stok hesabatına bax" : undefined,
      });
    } catch {
      checks.push({ key: "stok_alt", baslıq: "Stok-altı məhsullar", status: "warn", detay: "Yoxlanmadı" });
    }

    // 4. Tomorrow's tasks
    try {
      const tasksSay = await prisma.tapshiriqlar
        .count({
          where: {
            deadline: { gte: tomorrow, lt: new Date(tomorrow.getTime() + 86400000) },
            status: { notIn: ["tamamlandi", "bagli"] },
          },
        })
        .catch(() => 0);
      checks.push({
        key: "sabah_tapsiriq",
        baslıq: "Sabahkı plan",
        status: tasksSay > 0 ? "ok" : "warn",
        detay: tasksSay > 0 ? `${tasksSay} tapşırıq planlanıb` : "Sabah üçün tapşırıq yoxdur",
      });
    } catch {
      checks.push({ key: "sabah_tapsiriq", baslıq: "Sabahkı plan", status: "warn", detay: "Yoxlanmadı" });
    }

    // 5. Hesab balans uyğunsuzluq (negative or stale)
    try {
      const negHesab = await prisma.maliye_hesablari.count({
        where: { aktiv: true, qaliq: { lt: 0 } },
      }).catch(() => 0);
      checks.push({
        key: "balans",
        baslıq: "Hesab balansları",
        status: negHesab === 0 ? "ok" : "error",
        detay: negHesab === 0 ? "Bütün hesablar müsbətdir" : `${negHesab} hesabın qalığı mənfidir`,
        fix_href: negHesab > 0 ? "/maliyye/hesab" : undefined,
        fix_label: negHesab > 0 ? "Hesablara bax" : undefined,
      });
    } catch {
      checks.push({ key: "balans", baslıq: "Hesab balansları", status: "warn", detay: "Yoxlanmadı" });
    }

    return checks;
  });
}

export async function getGunSonuHistory(limit = 30): Promise<GunSonuRow[]> {
  return withTenant(async () => {
    try {
      const rows = await prisma.gun_sonu.findMany({
        orderBy: { tarix: "desc" },
        take: limit,
        include: {
          filiallar: { select: { ad: true } },
          istifadeciler: { select: { ad_soyad: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        tarix: r.tarix,
        filial_ad: r.filiallar?.ad ?? null,
        status: r.status ?? "aciq",
        satish_cem: Number(r.satish_cem ?? 0),
        xerc_cem: Number(r.xerc_cem ?? 0),
        menfeet: Number(r.menfeet ?? 0),
        kassa_qaliq: Number(r.kassa_qaliq ?? 0),
        kassa_ferq: Number(r.kassa_ferq ?? 0),
        problem_say: r.problem_say ?? 0,
        baglayan_ad: r.istifadeciler?.ad_soyad ?? null,
        bagh_tarix: r.bagh_tarix ?? null,
        qeyd: r.qeyd ?? null,
      }));
    } catch {
      return [];
    }
  });
}
