import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const QRUP = "ticaret";
const ACAR_AYLIK = "satis_aylik_hedef";

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
        nov: "number",
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
          status: { not: "legv" },
        },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: {
          tarix: { gte: today },
          qaralama: { not: true },
          status: { not: "legv" },
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
