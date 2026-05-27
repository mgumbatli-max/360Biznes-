import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getBonusProfil, type BonusKategoriya } from "./bonus-profile";

export type BonusKateqoriyaNeti = {
  kateqoriya: BonusKategoriya;
  label: string;
  pay_meblegh: number;       // bu kateqoriyanın bonus payı (₼)
  hedef: number;             // konfiqurasiyadan
  hedef_vahid: "faiz" | "mebleg";
  faktiki: number;           // gerçək göstərici
  nailiyyet_faiz: number;    // 0-100+ — hədəfə nə qədər çatılıb
  qazanilan_mebleg: number;  // bu kateqoriyadan qazanılan bonus
};

export type BonusHesablama = {
  istifadeci_id: string;
  istifadeci_ad: string;
  il: number;
  ay: number;
  metod: string;
  pool_mebleg: number;            // ümumi bonus pool
  kateqoriyalar: BonusKateqoriyaNeti[];
  qazanilan_cemi: number;         // bütün kateqoriyalardan
  paylanmayan_mebleg: number;     // pool-dan paylanmamış (boş kateqoriyalar)
};

export async function calculateMonthlyBonus(
  istifadeciId: string,
  il: number,
  ay: number,
): Promise<BonusHesablama | null> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const user = await prisma.istifadeciler.findUnique({
      where: { id: istifadeciId },
      select: { id: true, ad_soyad: true },
    });
    if (!user) return null;

    const profil = await getBonusProfil(istifadeciId);

    // 1. Pool məbləğini müəyyən et
    const periodStart = new Date(il, ay - 1, 1);
    const periodEnd = new Date(il, ay, 0, 23, 59, 59);

    let pool = 0;
    if (profil.metod === "fixed") {
      pool = profil.fixed_mebleg;
    } else if (profil.metod === "percent_satis" || profil.metod === "percent_menfaat") {
      const musteriFiltri =
        profil.musteri_filter === "mene_aid"
          ? { kontragentler: { menecer_id: istifadeciId } }
          : {};
      const salesAgg = await prisma.satis_sifarisleri.aggregate({
        _sum: { umumi_mebleg: true, son_mebleg: true },
        where: {
          sahibkar_id: sahibkarId,
          yaradan_id: istifadeciId,
          tarix: { gte: periodStart, lte: periodEnd },
          status: { notIn: ["legv", "tesdiq_gozleyir", "qaralama"] },
          ...musteriFiltri,
        },
      });
      const cemiSatis = Number(salesAgg._sum.son_mebleg ?? 0);
      if (profil.metod === "percent_satis") {
        pool = cemiSatis * (profil.percent / 100);
      } else {
        // mənfəət üçün line satirlarından maya çıxılır (təxmini)
        const lines = await prisma.satis_sifaris_satirlari.findMany({
          where: {
            sahibkar_id: sahibkarId,
            satis_sifarisleri: {
              yaradan_id: istifadeciId,
              tarix: { gte: periodStart, lte: periodEnd },
              status: { notIn: ["legv", "tesdiq_gozleyir", "qaralama"] },
              ...musteriFiltri,
            },
          },
          select: {
            miqdar: true,
            vahid_qiymet: true,
            mehsullar: { select: { alish_qiymeti: true } },
          },
        });
        let menfaat = 0;
        for (const l of lines) {
          const qty = Number(l.miqdar ?? 0);
          const satis = Number(l.vahid_qiymet ?? 0);
          const maya = Number(l.mehsullar?.alish_qiymeti ?? 0);
          menfaat += qty * (satis - maya);
        }
        pool = menfaat * (profil.percent / 100);
      }
    }
    pool = Math.max(0, pool);

    // 2. Hər kateqoriya üçün pay + nailiyyət hesabla
    const kateqoriyalar: BonusKateqoriyaNeti[] = [];
    let paylanmis = 0;

    for (const p of profil.paylanma) {
      const pay = p.tip === "mebleg" ? p.deyer : pool * (p.deyer / 100);
      paylanmis += pay;
      const calc = await calculateCategory(p.kateqoriya, istifadeciId, periodStart, periodEnd, p.hedef, profil.musteri_filter);
      const qazanilan = pay * Math.min(1, calc.nailiyyet_faiz / 100);
      const labelMap: Record<BonusKategoriya, string> = {
        davamiyyet: "Davamiyyət",
        tapsiriq: "Tapşırıqlar vaxtında",
        sehv_yoxlugu: "Səhvsiz proseslər",
        borc_yigim: "Borc yığımı",
        satis_hedef: "Satış hədəfi",
      };
      kateqoriyalar.push({
        kateqoriya: p.kateqoriya,
        label: labelMap[p.kateqoriya],
        pay_meblegh: pay,
        hedef: p.hedef,
        hedef_vahid: p.kateqoriya === "satis_hedef" ? "mebleg" : "faiz",
        faktiki: calc.faktiki,
        nailiyyet_faiz: calc.nailiyyet_faiz,
        qazanilan_mebleg: qazanilan,
      });
    }

    const qazanilan = kateqoriyalar.reduce((s, k) => s + k.qazanilan_mebleg, 0);

    return {
      istifadeci_id: user.id,
      istifadeci_ad: user.ad_soyad,
      il,
      ay,
      metod: profil.metod,
      pool_mebleg: pool,
      kateqoriyalar,
      qazanilan_cemi: qazanilan,
      paylanmayan_mebleg: Math.max(0, pool - paylanmis),
    };
  });
}

async function calculateCategory(
  k: BonusKategoriya,
  istifadeciId: string,
  start: Date,
  end: Date,
  hedef: number,
  musteriFilter: "hamisi" | "mene_aid",
): Promise<{ faktiki: number; nailiyyet_faiz: number }> {
  const { sahibkarId } = requireTenant();
  const musteriCond =
    musteriFilter === "mene_aid"
      ? { kontragentler: { menecer_id: istifadeciId } }
      : {};

  if (k === "davamiyyet") {
    // İş günlərinin sayını davamiyyet cədvəlindən hesabla
    const days = await prisma.davamiyyet.count({
      where: {
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        tarix: { gte: start, lte: end },
        status: "qaydasinda",
      },
    });
    // Hədəf gün sayı (ay 22 iş günü varsayım)
    const expectedDays = 22;
    const faktikiFaiz = Math.min(100, (days / expectedDays) * 100);
    return { faktiki: faktikiFaiz, nailiyyet_faiz: (faktikiFaiz / Math.max(1, hedef)) * 100 };
  }

  if (k === "tapsiriq") {
    const all = await prisma.tapshiriqlar.count({
      where: {
        sahibkar_id: sahibkarId,
        mesul_id: istifadeciId,
        deadline: { gte: start, lte: end },
      },
    });
    if (all === 0) return { faktiki: 0, nailiyyet_faiz: 0 };
    const onTime = await prisma.tapshiriqlar.count({
      where: {
        sahibkar_id: sahibkarId,
        mesul_id: istifadeciId,
        deadline: { gte: start, lte: end },
        tamamlandi_de: { not: null, lte: prisma.tapshiriqlar.fields.deadline },
      },
    });
    const faktikiFaiz = (onTime / all) * 100;
    return { faktiki: faktikiFaiz, nailiyyet_faiz: (faktikiFaiz / Math.max(1, hedef)) * 100 };
  }

  if (k === "sehv_yoxlugu") {
    const total = await prisma.tesdiq_telep.count({
      where: {
        sahibkar_id: sahibkarId,
        yaradan_id: istifadeciId,
        yaradildi: { gte: start, lte: end },
      },
    });
    if (total === 0) return { faktiki: 100, nailiyyet_faiz: 100 };
    const rejected = await prisma.tesdiq_telep.count({
      where: {
        sahibkar_id: sahibkarId,
        yaradan_id: istifadeciId,
        yaradildi: { gte: start, lte: end },
        status: "red",
      },
    });
    const faktikiFaiz = ((total - rejected) / total) * 100;
    return { faktiki: faktikiFaiz, nailiyyet_faiz: (faktikiFaiz / Math.max(1, hedef)) * 100 };
  }

  if (k === "borc_yigim") {
    // Bu ay yığılan borc ödənişləri — finance_operations cədvəlindən
    // (daxil/y_n="daxil" + satıcı=bu istifadəçi olan satışın ödənişləri)
    const collected = await prisma.finance_operations.aggregate({
      _sum: { meblegh: true },
      where: {
        sahibkar_id: sahibkarId,
        y_n: "daxil",
        tarix: { gte: start, lte: end },
        // Bu satıcının yaratdığı satışlara bağlı ödəniş
        satis_sifarisleri: {
          yaradan_id: istifadeciId,
          odenis_nov: { in: ["nisye", "borc"] },
          ...musteriCond,
        },
      },
    }).catch(() => null);
    const collectedAmt = Number(collected?._sum.meblegh ?? 0);
    // Yığım hədəfi: portfeldəki borcun hədəf %-i
    const portfolio = await prisma.satis_sifarisleri.aggregate({
      _sum: { son_mebleg: true, odenilmis: true },
      where: {
        sahibkar_id: sahibkarId,
        yaradan_id: istifadeciId,
        odenis_nov: { in: ["nisye", "borc"] },
        tarix: { lt: end },
        ...musteriCond,
      },
    });
    const portfolioMebleg = Number(portfolio._sum.son_mebleg ?? 0) - Number(portfolio._sum.odenilmis ?? 0);
    const targetAmt = portfolioMebleg * (hedef / 100);
    if (targetAmt <= 0) return { faktiki: collectedAmt, nailiyyet_faiz: collectedAmt > 0 ? 100 : 0 };
    return { faktiki: collectedAmt, nailiyyet_faiz: (collectedAmt / targetAmt) * 100 };
  }

  if (k === "satis_hedef") {
    const agg = await prisma.satis_sifarisleri.aggregate({
      _sum: { son_mebleg: true },
      where: {
        sahibkar_id: sahibkarId,
        yaradan_id: istifadeciId,
        tarix: { gte: start, lte: end },
        status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        ...musteriCond,
      },
    });
    const cemiSatis = Number(agg._sum.son_mebleg ?? 0);
    if (hedef <= 0) return { faktiki: cemiSatis, nailiyyet_faiz: 100 };
    return { faktiki: cemiSatis, nailiyyet_faiz: (cemiSatis / hedef) * 100 };
  }

  return { faktiki: 0, nailiyyet_faiz: 0 };
}
