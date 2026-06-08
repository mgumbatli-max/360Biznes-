import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export type TodayPulse = {
  // Bu gün metrikləri
  satis_count: number;
  satis_mebleg: number;
  xerc_mebleg: number;
  net_kassa: number;
  yeni_musteri: number;
  yeni_tapsiriq: number;
  tamamlanan_tapsiriq: number;
  qaytarma_count: number;
  qaytarma_mebleg: number;
  // Müqayisə — dünən
  dunen_satis_mebleg: number;
  dunen_satis_count: number;
  // Müqayisə — keçən həftə eyni gün
  keçen_hefte_satis_mebleg: number;
  // Saatlıq nəbz
  saatliq_satis: { saat: number; count: number; mebleg: number }[];
  // İcmal qiymət
  status: "ela" | "yaxshi" | "orta" | "zeyif" | "kritik";
  status_mesaj: string;
  hour_now: number;
};

export async function getTodayPulse(): Promise<TodayPulse> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(today);
    yesterdayEnd.setSeconds(-1);
    const lastWeekSameDay = new Date(today);
    lastWeekSameDay.setDate(lastWeekSameDay.getDate() - 7);
    const lastWeekSameDayEnd = new Date(lastWeekSameDay);
    lastWeekSameDayEnd.setDate(lastWeekSameDayEnd.getDate() + 1);

    const [
      todaySales, todayExpense, todayNewCust, todayTasks, todayCompleted,
      todayReturns, yesterdaySales, lastWeekSales, hourlySales,
    ] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: today, lt: tomorrow },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.xercl_r.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: today, lt: tomorrow }, legv_de: null },
        _sum: { mebleg: true },
      }),
      prisma.kontragentler.count({
        where: { sahibkar_id: sahibkarId, yaradildi: { gte: today, lt: tomorrow }, nov: { in: ["musteri", "her_ikisi"] } },
      }),
      prisma.tapshiriqlar.count({
        where: { sahibkar_id: sahibkarId, yaradildi: { gte: today, lt: tomorrow } },
      }),
      prisma.tapshiriqlar.count({
        where: { sahibkar_id: sahibkarId, tamamlandi_de: { gte: today, lt: tomorrow } },
      }),
      prisma.qaytarma_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: today, lt: tomorrow } },
        _sum: { umumi_mebleg: true },
        _count: { _all: true },
      }).catch(() => ({ _sum: { umumi_mebleg: null }, _count: { _all: 0 } })),
      // Dünən
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: yesterday, lt: today },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      // Keçən həftə eyni gün
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: lastWeekSameDay, lt: lastWeekSameDayEnd },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { son_mebleg: true },
      }),
      // Saatlıq dəyişkənlik
      prisma.$queryRaw<{ saat: number; count: bigint; mebleg: number }[]>`
        SELECT EXTRACT(HOUR FROM tarix)::int AS saat,
               COUNT(*)::bigint AS count,
               COALESCE(SUM(son_mebleg), 0)::float AS mebleg
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix >= ${today} AND tarix < ${tomorrow}
           AND status NOT IN ('legv', 'qaralama', 'tesdiq_gozleyir')
         GROUP BY EXTRACT(HOUR FROM tarix)
         ORDER BY saat
      `.catch(() => []),
    ]);

    const satisMebleg = Number(todaySales._sum.son_mebleg ?? 0);
    const satisCount = todaySales._count._all;
    const xercMebleg = Number(todayExpense._sum.mebleg ?? 0);
    const dunenMebleg = Number(yesterdaySales._sum.son_mebleg ?? 0);
    const dunenCount = yesterdaySales._count._all;
    const keçenHefteMebleg = Number(lastWeekSales._sum.son_mebleg ?? 0);
    const qaytarmaMebleg = Number(todayReturns._sum.umumi_mebleg ?? 0);

    // Status hesabla
    const hourNow = now.getHours();
    const expectedRatio = hourNow >= 18 ? 1.0 : Math.max(0.1, hourNow / 18); // gözlənilən proqress
    const expectedMebleg = dunenMebleg * expectedRatio;
    const ratio = expectedMebleg > 0 ? satisMebleg / expectedMebleg : satisMebleg > 0 ? 1 : 0;

    let status: TodayPulse["status"];
    let status_mesaj: string;
    if (satisCount === 0 && hourNow >= 12) {
      status = "kritik";
      status_mesaj = "Bu gün hələ heç bir satış yoxdur — yoxla";
    } else if (ratio >= 1.2) {
      status = "ela";
      status_mesaj = "Möhtəşəm gün — keçən günü 20%+ keçir";
    } else if (ratio >= 1.0) {
      status = "yaxshi";
      status_mesaj = "Yaxşı gün — keçən günlə bərabər və ya daha yaxşı";
    } else if (ratio >= 0.7) {
      status = "orta";
      status_mesaj = "Orta gün — keçən gündən bir az aşağı";
    } else if (ratio >= 0.4) {
      status = "zeyif";
      status_mesaj = "Zəif gün — keçən günün yarısından az";
    } else {
      status = "kritik";
      status_mesaj = "Çox zəif — diqqət lazımdır";
    }

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      satis_count: satisCount,
      satis_mebleg: satisMebleg * s,
      xerc_mebleg: xercMebleg * s,
      net_kassa: (satisMebleg - xercMebleg) * s,
      yeni_musteri: todayNewCust,
      yeni_tapsiriq: todayTasks,
      tamamlanan_tapsiriq: todayCompleted,
      qaytarma_count: Number(todayReturns._count?._all ?? 0),
      qaytarma_mebleg: qaytarmaMebleg * s,
      dunen_satis_mebleg: dunenMebleg * s,
      dunen_satis_count: dunenCount,
      keçen_hefte_satis_mebleg: keçenHefteMebleg * s,
      saatliq_satis: hourlySales.map((h) => ({
        saat: Number(h.saat),
        count: Number(h.count),
        mebleg: Number(h.mebleg) * s,
      })),
      status,
      status_mesaj,
      hour_now: hourNow,
    };
  });
}
