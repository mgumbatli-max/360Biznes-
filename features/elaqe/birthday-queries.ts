import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type BirthdayRow = {
  id: string;
  ad: string;
  telefon: string | null;
  dogum_tarixi: Date;
  yas: number;       // bu il neçə yaş olacaq
  gun_qalib: number; // 0 = bu gün, 1 = sabah, 30 = 30 gün sonra
  tip: "musteri" | "techizatci" | "her_ikisi" | "isci";
  borc: number;     // müştəri üçün, opsional məlumat
};

/**
 * Növbəti N gün ərzində doğum günü olan müştərilər və əməkdaşlar.
 * Avto-xatırlatma və kampaniya üçün istifadə olunur.
 */
export async function getUpcomingBirthdays(days = 30): Promise<BirthdayRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [kontragentler, istifadeciler] = await Promise.all([
      prisma.kontragentler.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true, dogum_tarixi: { not: null } },
        select: { id: true, ad: true, telefon: true, dogum_tarixi: true, nov: true, borc: true },
      }),
      prisma.istifadeciler.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true, dogum_tarixi: { not: null }, isden_cixdi: null },
        select: { id: true, ad_soyad: true, telefon: true, dogum_tarixi: true },
      }),
    ]);

    const rows: BirthdayRow[] = [];

    for (const k of kontragentler) {
      if (!k.dogum_tarixi) continue;
      const gunQalib = daysUntilNextBirthday(k.dogum_tarixi, today);
      if (gunQalib > days) continue;
      const yas = getNextAge(k.dogum_tarixi, today);
      rows.push({
        id: k.id,
        ad: k.ad,
        telefon: k.telefon,
        dogum_tarixi: k.dogum_tarixi,
        yas,
        gun_qalib: gunQalib,
        tip: (k.nov as "musteri" | "techizatci" | "her_ikisi") ?? "musteri",
        borc: Number(k.borc ?? 0),
      });
    }
    for (const u of istifadeciler) {
      if (!u.dogum_tarixi) continue;
      const gunQalib = daysUntilNextBirthday(u.dogum_tarixi, today);
      if (gunQalib > days) continue;
      const yas = getNextAge(u.dogum_tarixi, today);
      rows.push({
        id: u.id,
        ad: u.ad_soyad,
        telefon: u.telefon,
        dogum_tarixi: u.dogum_tarixi,
        yas,
        gun_qalib: gunQalib,
        tip: "isci",
        borc: 0,
      });
    }

    rows.sort((a, b) => a.gun_qalib - b.gun_qalib);
    return rows;
  });
}

function daysUntilNextBirthday(dt: Date, refToday: Date): number {
  // Növbəti doğum günü tarixi
  const next = new Date(refToday.getFullYear(), dt.getMonth(), dt.getDate());
  if (next < refToday) next.setFullYear(next.getFullYear() + 1);
  const diffMs = next.getTime() - refToday.getTime();
  return Math.round(diffMs / 86400000);
}

function getNextAge(dt: Date, refToday: Date): number {
  let age = refToday.getFullYear() - dt.getFullYear();
  const nextBday = new Date(refToday.getFullYear(), dt.getMonth(), dt.getDate());
  if (nextBday < refToday) age += 1;
  return age;
}
