import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export type SalesForecast = {
  // Cari ay
  cari_ay_indiye_qeder: number;
  cari_ay_gun_keçib: number;
  cari_ay_qalan_gun: number;
  cari_ay_proqnoz: number;       // ayın sonuna qədər
  // Müqayisə
  kecen_ay_eyni_gun: number;    // keçən ayın eyni gününə qədər
  kecen_ay_cemi: number;        // keçən ayın tam cəmi
  trend_faiz: number;            // cari vs keçən ay (eyni günə qədər)
  // Sürət
  gunluk_orta: number;          // bu ayın günlük ortalaması
  son_7_gun_orta: number;       // son 7 günün günlük ortalaması
  // Mövsümi düzəliş
  ilki_eyni_ay: number;          // ötən ilin eyni ayı (varsa)
  // Etibarlılıq
  etibarlilik: "yuksek" | "orta" | "asagi";
  mesaj: string;
};

/**
 * Aylıq satış proqnozu — sahibkarın "ay sonuna qədər nə qədər olacaq?" sualına cavab.
 *
 * Hesablama:
 *  1. Bu ay indiyə qədər → faktiki
 *  2. Bu ay günlük ortalama
 *  3. Son 7 günün günlük ortalaması (daha aktual trend)
 *  4. Çəkili proqnoz: 60% son 7 gün × qalan gün + 40% ayın ortalaması × qalan gün
 *  5. Mövsümi düzəliş əgər ötən il var
 */
export async function getSalesForecast(): Promise<SalesForecast> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const last7Start = new Date(today);
    last7Start.setDate(last7Start.getDate() - 7);

    const cariGunSay = Math.max(1, today.getDate());
    const ayinCemiGunu = monthEnd.getDate();
    const qalanGun = ayinCemiGunu - cariGunSay;

    // Keçən ay
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthSameDay = new Date(lastMonthStart);
    lastMonthSameDay.setDate(Math.min(cariGunSay, lastMonthEnd.getDate()));

    // Ötən ilin eyni ayı
    const lastYearMonthStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const lastYearMonthEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0);

    const [cari, last7, kecenAyEyniGun, kecenAyCemi, ilkiEyniAy] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: monthStart, lte: today },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: last7Start, lte: today },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: lastMonthStart, lte: lastMonthSameDay },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: lastMonthStart, lte: lastMonthEnd },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: lastYearMonthStart, lte: lastYearMonthEnd },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { son_mebleg: true },
      }),
    ]);

    const cariMeb = Number(cari._sum.son_mebleg ?? 0);
    const last7Meb = Number(last7._sum.son_mebleg ?? 0);
    const kecenAyEyniMeb = Number(kecenAyEyniGun._sum.son_mebleg ?? 0);
    const kecenAyCemiMeb = Number(kecenAyCemi._sum.son_mebleg ?? 0);
    const ilkiMeb = Number(ilkiEyniAy._sum.son_mebleg ?? 0);

    const gunlukOrta = cariMeb / cariGunSay;
    const son7Orta = last7Meb / 7;

    // Çəkili proqnoz: 60% son 7 gün + 40% bütün ay ortalaması
    const cekiliGunluk = son7Orta * 0.6 + gunlukOrta * 0.4;
    let proqnoz = cariMeb + cekiliGunluk * qalanGun;

    // Mövsümi düzəliş — əgər keçən il var
    if (ilkiMeb > 0 && kecenAyCemiMeb > 0) {
      // Bu ayın ötən ilə nisbəti
      const movsumiKatsayi = ilkiMeb / kecenAyCemiMeb;
      // Düzəliş: 80% trend, 20% mövsümi
      const movsumiProqnoz = cariMeb + (cekiliGunluk * movsumiKatsayi * qalanGun);
      proqnoz = proqnoz * 0.8 + movsumiProqnoz * 0.2;
    }

    const trendFaiz = kecenAyEyniMeb > 0
      ? ((cariMeb - kecenAyEyniMeb) / kecenAyEyniMeb) * 100
      : 0;

    // Etibarlılıq
    let etibarlilik: SalesForecast["etibarlilik"];
    let mesaj: string;
    if (cariGunSay < 7) {
      etibarlilik = "asagi";
      mesaj = "Ay yenidir, az data var — proqnoz qəti deyil";
    } else if (last7Meb === 0) {
      etibarlilik = "asagi";
      mesaj = "Son 7 gündə satış yoxdur — diqqət!";
    } else if (Math.abs(trendFaiz) > 50) {
      etibarlilik = "orta";
      mesaj = `Trend kəskin dəyişib (${trendFaiz.toFixed(0)}%) — proqnoz orta dəqiqlikdə`;
    } else {
      etibarlilik = "yuksek";
      mesaj = trendFaiz > 0
        ? `Müsbət trend (+${trendFaiz.toFixed(0)}%) — proqnoz etibarlıdır`
        : trendFaiz < 0
          ? `Mənfi trend (${trendFaiz.toFixed(0)}%) — proqnoz etibarlıdır`
          : "Sabit trend — proqnoz etibarlıdır";
    }

    const stealth = await getStealthState();
    const k = stealth.aktiv ? stealth.scale : 1;

    return {
      cari_ay_indiye_qeder: cariMeb * k,
      cari_ay_gun_keçib: cariGunSay,
      cari_ay_qalan_gun: qalanGun,
      cari_ay_proqnoz: proqnoz * k,
      kecen_ay_eyni_gun: kecenAyEyniMeb * k,
      kecen_ay_cemi: kecenAyCemiMeb * k,
      trend_faiz: trendFaiz,
      gunluk_orta: gunlukOrta * k,
      son_7_gun_orta: son7Orta * k,
      ilki_eyni_ay: ilkiMeb * k,
      etibarlilik,
      mesaj,
    };
  });
}
