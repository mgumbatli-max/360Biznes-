import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type InaktivMusteri = {
  id: string;
  ad: string;
  telefon: string | null;
  son_satis_tarix: Date | null;
  son_satis_nomre: string | null;
  son_satis_mebleg: number;
  gun_qalib: number;          // Neçə gündür almayıb
  cemi_satis_say: number;     // Tarix boyu cəmi satış sayı
  cemi_satis_mebleg: number;  // Tarix boyu cəmi məbləğ
  borc: number;
  rfm_seviyye: "vip" | "sadiq" | "itirilmekde" | "passiv";
};

/**
 * İnaktiv müştərilər — müəyyən gün sayından az alışı olanlar.
 *
 * RFM analizi əsasında səviyyə təyin edilir:
 *  - VIP: cəm 5000+ ₼ + son 60 günə qədər
 *  - Sadiq: 5+ satış + son 90 günə qədər
 *  - İtirilməkdə: 30-90 gün almayıb (re-engagement!)
 *  - Passiv: 90+ gün almayıb
 */
export async function getInaktivMusteriler(minGun = 30): Promise<InaktivMusteri[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - minGun);

    // Bütün aktiv müştərilər
    const musteriler = await prisma.kontragentler.findMany({
      where: {
        sahibkar_id: sahibkarId,
        aktiv: true,
        nov: { in: ["musteri", "her_ikisi"] },
      },
      select: { id: true, ad: true, telefon: true, borc: true },
    });
    if (musteriler.length === 0) return [];
    const ids = musteriler.map((m) => m.id);

    // Hər müştəri üçün son satış + cəm
    const [lastSales, totals] = await Promise.all([
      prisma.$queryRaw<{ musteri_id: string; tarix: Date; nomre: string; son_mebleg: number }[]>`
        SELECT DISTINCT ON (musteri_id) musteri_id, tarix, nomre,
               COALESCE(son_mebleg, 0)::float AS son_mebleg
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND musteri_id = ANY(${ids}::uuid[])
           AND status NOT IN ('legv', 'qaralama', 'tesdiq_gozleyir')
         ORDER BY musteri_id, tarix DESC
      `.catch(() => [] as never[]),
      prisma.$queryRaw<{ musteri_id: string; cnt: bigint; total: number }[]>`
        SELECT musteri_id, COUNT(*)::bigint AS cnt,
               COALESCE(SUM(son_mebleg), 0)::float AS total
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND musteri_id = ANY(${ids}::uuid[])
           AND status NOT IN ('legv', 'qaralama', 'tesdiq_gozleyir')
         GROUP BY musteri_id
      `.catch(() => [] as never[]),
    ]);

    const lastSalesMap = new Map(lastSales.map((s) => [s.musteri_id, s]));
    const totalsMap = new Map(totals.map((t) => [t.musteri_id, t]));

    const rows: InaktivMusteri[] = [];
    for (const m of musteriler) {
      const ls = lastSalesMap.get(m.id);
      const tot = totalsMap.get(m.id);
      if (!ls) continue; // heç vaxt almayıb — atla
      const lastDate = ls.tarix;
      if (lastDate > cutoffDate) continue; // hələ də aktiv

      const gunQalib = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
      const cemiSay = Number(tot?.cnt ?? 0);
      const cemiMebleg = Number(tot?.total ?? 0);

      let seviyye: InaktivMusteri["rfm_seviyye"];
      if (cemiMebleg >= 5000 && gunQalib <= 60) seviyye = "vip";
      else if (cemiSay >= 5 && gunQalib <= 90) seviyye = "sadiq";
      else if (gunQalib <= 90) seviyye = "itirilmekde";
      else seviyye = "passiv";

      rows.push({
        id: m.id,
        ad: m.ad,
        telefon: m.telefon,
        son_satis_tarix: lastDate,
        son_satis_nomre: ls.nomre,
        son_satis_mebleg: Number(ls.son_mebleg),
        gun_qalib: gunQalib,
        cemi_satis_say: cemiSay,
        cemi_satis_mebleg: cemiMebleg,
        borc: Number(m.borc ?? 0),
        rfm_seviyye: seviyye,
      });
    }

    // Sıra: VIP/Sadiq əvvəl, sonra köhnəlik üzrə
    const priority = { vip: 0, sadiq: 1, itirilmekde: 2, passiv: 3 };
    rows.sort((a, b) => {
      if (priority[a.rfm_seviyye] !== priority[b.rfm_seviyye]) {
        return priority[a.rfm_seviyye] - priority[b.rfm_seviyye];
      }
      return a.gun_qalib - b.gun_qalib;
    });

    return rows;
  });
}
