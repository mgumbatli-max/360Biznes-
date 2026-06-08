import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export type CashRunway = {
  // Mövcud nağd
  kassa_balans: number;
  hesab_balans: number;
  cemi_nagd: number;
  // Alacaqlar / verəcəklər
  alici_borc: number;        // bizə borc — gələcək gəlir
  techizatci_borc: number;    // biz borc — gələcək xərc
  net_pozisiya: number;       // nağd + alacaq - verəcək
  // Aylıq trend
  ayliq_orta_gelir: number;   // son 3 ayın orta gəliri
  ayliq_orta_xerc: number;    // son 3 ayın orta xərci
  ayliq_net_flow: number;     // gelir - xerc (mənfi = burn rate)
  // Hesablama
  runway_gun: number | null;  // neçə günə pulun qalır (mənfi flow olduqda)
  saglamliq: "sagligli" | "diqqet" | "kritik";
  saglamliq_mesaj: string;
};

/**
 * Cash Runway — Silicon Valley CEO metriki.
 *
 * "Sənin biznesin mövcud xərc tempi ilə neçə gün dözə bilir?"
 *
 * Formula:
 *   - Cəmi nağd = kassa + bank
 *   - Net pozisiya = nağd + alıcı borc - təchizatçı borc
 *   - Aylıq net flow = son 3 ayın orta gəliri - orta xərci
 *   - Runway gün = net pozisiya / (mənfi günlük flow)
 *
 * Sağlamlıq:
 *   - Sağligli: müsbət flow və ya 6+ ay runway
 *   - Diqqət: 3-6 ay runway
 *   - Kritik: < 3 ay runway
 */
export async function getCashRunway(): Promise<CashRunway> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    const [kassa, hesab, customers, suppliers, gelirAgg, xercAgg, kassaCixisAgg] = await Promise.all([
      // Açıq kassa qalığı
      prisma.kassalar.aggregate({
        where: { sahibkar_id: sahibkarId, status: "acig" },
        _sum: { acilis_qaligi: true },
      }),
      // Bank hesab balansı
      prisma.maliye_hesablari.aggregate({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        _sum: { qaliq: true },
      }),
      // Müştəri borcları (bizə)
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(borc), 0)::float AS total
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND nov IN ('musteri', 'her_ikisi')
           AND borc > 0
      `,
      // Təchizatçı borcları (biz)
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(ABS(SUM(LEAST(borc, 0))), 0)::float AS total
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND nov IN ('techizatci', 'her_ikisi')
      `,
      // Son 3 ay daxil olan gəlir
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: threeMonthsAgo },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { odenilmis: true },
      }),
      // Son 3 ay ümumi xərc
      prisma.xercl_r.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: threeMonthsAgo }, legv_de: null },
        _sum: { mebleg: true },
      }),
      // Kassa nağd çıxışları (alış və başqaları) — daha dəqiq olmaq üçün
      prisma.kassa_emeliyyatlari.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          emeliyyat_nov: { in: ["alis", "xerc", "borc_odenis"] },
          tarix: { gte: threeMonthsAgo },
        },
        _sum: { mebleg: true },
      }).catch(() => ({ _sum: { mebleg: null } })),
    ]);

    const kassaBalans = Number(kassa._sum.acilis_qaligi ?? 0);
    const hesabBalans = Number(hesab._sum.qaliq ?? 0);
    const cemiNagd = kassaBalans + hesabBalans;

    const aliciBorc = Number(customers[0]?.total ?? 0);
    const techizatciBorc = Number(suppliers[0]?.total ?? 0);
    const netPozisiya = cemiNagd + aliciBorc - techizatciBorc;

    // Aylıq orta
    const cemGelir = Number(gelirAgg._sum.odenilmis ?? 0);
    const cemXerc = Number(xercAgg._sum.mebleg ?? 0) + Number(kassaCixisAgg._sum.mebleg ?? 0);
    const ayliqOrtaGelir = cemGelir / 3;
    const ayliqOrtaXerc = cemXerc / 3;
    const ayliqNetFlow = ayliqOrtaGelir - ayliqOrtaXerc;

    // Runway hesabla — yalnız mənfi flow olduqda mənalıdır
    let runwayGun: number | null = null;
    if (ayliqNetFlow < 0 && cemiNagd > 0) {
      const gunlukBurn = Math.abs(ayliqNetFlow) / 30;
      if (gunlukBurn > 0) runwayGun = Math.floor(cemiNagd / gunlukBurn);
    }

    let saglamliq: CashRunway["saglamliq"];
    let saglamliq_mesaj: string;
    if (ayliqNetFlow >= 0) {
      saglamliq = "sagligli";
      saglamliq_mesaj = "Biznes müsbət axındadır — gəlir xərcdən artıqdır";
    } else if (runwayGun !== null && runwayGun >= 180) {
      saglamliq = "sagligli";
      saglamliq_mesaj = "6+ ay nağd ehtiyatın var — sakit ol";
    } else if (runwayGun !== null && runwayGun >= 90) {
      saglamliq = "diqqet";
      saglamliq_mesaj = "3-6 ay runway — strategiya yenilə";
    } else if (runwayGun !== null && runwayGun < 90) {
      saglamliq = "kritik";
      saglamliq_mesaj = "3 aydan az nağd — təcili xərc azalt və ya gəlir artır";
    } else {
      saglamliq = "diqqet";
      saglamliq_mesaj = "Trend müəyyən deyil — kifayət data yoxdur";
    }

    // Gizli mod tətbiqi
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      kassa_balans: kassaBalans * s,
      hesab_balans: hesabBalans * s,
      cemi_nagd: cemiNagd * s,
      alici_borc: aliciBorc * s,
      techizatci_borc: techizatciBorc * s,
      net_pozisiya: netPozisiya * s,
      ayliq_orta_gelir: ayliqOrtaGelir * s,
      ayliq_orta_xerc: ayliqOrtaXerc * s,
      ayliq_net_flow: ayliqNetFlow * s,
      runway_gun: runwayGun, // gün sayı — scale tətbiq olunmur
      saglamliq,
      saglamliq_mesaj,
    };
  });
}
