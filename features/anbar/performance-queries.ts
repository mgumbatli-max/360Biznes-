import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Məhsul performans dashboard query-ləri.
 * Detail səhifədə "Performans" section üçün — top müştəri, kanal bölgü,
 * qaytarma faizi, stok dövriyyə günü.
 */

export type TopCustomerRow = {
  id: string;
  ad: string;
  telefon: string | null;
  miqdar: number;
  mebleg: number;
  sifaris_say: number;
  son_alis: Date | null;
};

export type ChannelBreakdown = {
  kanal: string;
  label: string;
  qty: number;
  mebleg: number;
  pct_qty: number;
};

export type ProductPerformance = {
  // Qaytarma %
  qaytarma_qty: number;
  qaytarma_pct: number; // qaytarma_qty / satilan_qty * 100
  // Stok dövriyyə
  stok_dovriyye_gun: number; // cari_stok / orta_gunluk satış (0 = bitmir)
  orta_gunluk_satish: number;
  // Mənfəət
  brut_mar: number; // (satış - maya) / satış * 100
  cemi_mar_azn: number; // 30 gün mənfəət
  // Top müştərilər
  top_customers: TopCustomerRow[];
  // Kanal bölgü
  channels: ChannelBreakdown[];
  // Aylıq trend (12 ay)
  aylar: { ay: string; qty: number; mebleg: number }[];
};

const CHANNEL_LABELS: Record<string, string> = {
  pos: "POS",
  marketplace: "Marketplace",
  manual: "Adi satış",
  borc: "Kreditlə",
  online: "Sayt",
};

function detectChannel(ss: { kassa_id: string | null; marketplace_platform: string | null; odenis_nov: string | null }): string {
  if (ss.marketplace_platform) return "marketplace";
  if (ss.kassa_id) return "pos";
  if (ss.odenis_nov === "nisye" || ss.odenis_nov === "borc") return "borc";
  return "manual";
}

export async function getProductPerformance(mehsul_id: string): Promise<ProductPerformance> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const day30 = new Date(Date.now() - 30 * 86400 * 1000);
    const day365 = new Date(Date.now() - 365 * 86400 * 1000);

    // 1) Cari stok
    const stokAgg = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(miqdar), 0)::float AS total
        FROM stok
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND mehsul_id = ${mehsul_id}::uuid
    `;
    const cariStok = stokAgg[0]?.total ?? 0;

    // 2) Maya — son alış qiyməti
    const mayaRow = await prisma.mehsullar.findUnique({
      where: { id: mehsul_id },
      select: { alish_qiymeti: true, satis_qiymeti: true },
    });
    const maya = Number(mayaRow?.alish_qiymeti ?? 0);

    // 3) Qaytarmalar 30 gün
    const qaytarmaAgg = await prisma.$queryRaw<{ qty: number }[]>`
      SELECT COALESCE(SUM(qs.miqdar), 0)::float AS qty
        FROM qaytarma_satirlari qs
        JOIN qaytarma_sifarisleri q ON q.id = qs.qaytarma_id
       WHERE qs.sahibkar_id = ${sahibkarId}::uuid
         AND qs.mehsul_id = ${mehsul_id}::uuid
         AND q.tarix >= ${day30}
         AND q.status != 'legv'
    `;
    const qaytarmaQty = qaytarmaAgg[0]?.qty ?? 0;

    // 4) Son 30 gün satılan miqdar (qaytarma %-ni hesablamaq üçün)
    const satilan30 = await prisma.$queryRaw<{ qty: number; mebleg: number }[]>`
      SELECT COALESCE(SUM(sls.miqdar), 0)::float AS qty,
             COALESCE(SUM(sls.cemi), 0)::float AS mebleg
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND sls.mehsul_id = ${mehsul_id}::uuid
         AND ss.tarix >= ${day30}
         AND ss.status != 'legv'
    `;
    const satilanQty30 = satilan30[0]?.qty ?? 0;
    const satilanMebleg30 = satilan30[0]?.mebleg ?? 0;
    const ortaGunluk = satilanQty30 / 30;
    const stokDovriyyeGun = ortaGunluk > 0 ? Math.round(cariStok / ortaGunluk) : 0;

    // 5) Mənfəət — son 30 gün
    const brutMar = satilanMebleg30 > 0 && maya > 0
      ? Math.round(((satilanMebleg30 - maya * satilanQty30) / satilanMebleg30) * 1000) / 10
      : 0;
    const cemiMarAzn = satilanMebleg30 - maya * satilanQty30;

    // 6) Qaytarma faiz
    const qaytarmaPct = satilanQty30 > 0
      ? Math.round((qaytarmaQty / satilanQty30) * 1000) / 10
      : 0;

    // 7) Top 5 müştəri (1 il)
    const topRows = await prisma.$queryRaw<Array<{
      musteri_id: string | null;
      ad: string | null;
      telefon: string | null;
      qty: number;
      mebleg: number;
      sifaris_say: number;
      son_alis: Date | null;
    }>>`
      SELECT
        k.id::text AS musteri_id,
        k.ad,
        k.telefon,
        COALESCE(SUM(sls.miqdar), 0)::float AS qty,
        COALESCE(SUM(sls.cemi), 0)::float AS mebleg,
        COUNT(DISTINCT ss.id)::int AS sifaris_say,
        MAX(ss.tarix) AS son_alis
      FROM satis_sifaris_satirlari sls
      JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
      JOIN kontragentler k ON k.id = ss.musteri_id
      WHERE sls.sahibkar_id = ${sahibkarId}::uuid
        AND sls.mehsul_id = ${mehsul_id}::uuid
        AND ss.tarix >= ${day365}
        AND ss.status != 'legv'
        AND ss.musteri_id IS NOT NULL
      GROUP BY k.id, k.ad, k.telefon
      ORDER BY mebleg DESC NULLS LAST
      LIMIT 5
    `;

    const topCustomers: TopCustomerRow[] = topRows.map((r) => ({
      id: r.musteri_id ?? "",
      ad: r.ad ?? "Naməlum",
      telefon: r.telefon,
      miqdar: r.qty,
      mebleg: r.mebleg,
      sifaris_say: r.sifaris_say,
      son_alis: r.son_alis,
    }));

    // 8) Kanal bölgü (90 gün)
    const day90 = new Date(Date.now() - 90 * 86400 * 1000);
    const channelRows = await prisma.satis_sifaris_satirlari.findMany({
      where: {
        mehsul_id,
        satis_sifarisleri: {
          tarix: { gte: day90 },
          status: { not: "legv" },
        },
      },
      include: {
        satis_sifarisleri: {
          select: { kassa_id: true, marketplace_platform: true, odenis_nov: true },
        },
      },
      take: 5000,
    });

    const channelMap = new Map<string, { qty: number; mebleg: number }>();
    let totalChannelQty = 0;
    for (const sls of channelRows) {
      if (!sls.satis_sifarisleri) continue;
      const ch = detectChannel(sls.satis_sifarisleri);
      const qty = Number(sls.miqdar ?? 0);
      const cemi = Number(sls.cemi ?? 0);
      const b = channelMap.get(ch) ?? { qty: 0, mebleg: 0 };
      b.qty += qty;
      b.mebleg += cemi;
      channelMap.set(ch, b);
      totalChannelQty += qty;
    }
    const channels: ChannelBreakdown[] = Array.from(channelMap.entries())
      .map(([kanal, v]) => ({
        kanal,
        label: CHANNEL_LABELS[kanal] ?? kanal,
        qty: v.qty,
        mebleg: v.mebleg,
        pct_qty: totalChannelQty > 0 ? Math.round((v.qty / totalChannelQty) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.qty - a.qty);

    // 9) Aylıq trend (12 ay)
    const aylar = await prisma.$queryRaw<{ ay: string; qty: number; mebleg: number }[]>`
      SELECT to_char(date_trunc('month', ss.tarix), 'YYYY-MM') AS ay,
             COALESCE(SUM(sls.miqdar), 0)::float AS qty,
             COALESCE(SUM(sls.cemi), 0)::float AS mebleg
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND sls.mehsul_id = ${mehsul_id}::uuid
         AND ss.tarix >= CURRENT_DATE - INTERVAL '12 months'
         AND ss.status != 'legv'
       GROUP BY ay
       ORDER BY ay ASC
    `;

    return {
      qaytarma_qty: qaytarmaQty,
      qaytarma_pct: qaytarmaPct,
      stok_dovriyye_gun: stokDovriyyeGun,
      orta_gunluk_satish: Math.round(ortaGunluk * 100) / 100,
      brut_mar: brutMar,
      cemi_mar_azn: cemiMarAzn,
      top_customers: topCustomers,
      channels,
      aylar,
    };
  });
}
