import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export async function getProductDetail(id: string) {
  return withTenant(async () => {
    return prisma.mehsullar.findUnique({
      where: { id },
      include: {
        kateqoriyalar: { select: { id: true, ad: true } },
        markalar: { select: { id: true, ad: true } },
        olcu_vahidleri: { select: { ad: true, qisa: true } },
      },
    });
  });
}

export async function getStockByWarehouse(mehsul_id: string) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.$queryRaw<{ anbar_id: number; anbar_ad: string; miqdar: number; son_qiymet: number | null }[]>`
      SELECT a.id AS anbar_id, a.ad AS anbar_ad,
             COALESCE(s.miqdar, 0)::float AS miqdar,
             s.son_qiymet::float AS son_qiymet
        FROM anbarlar a
        LEFT JOIN stok s ON s.anbar_id = a.id AND s.mehsul_id = ${mehsul_id}::uuid
       WHERE a.sahibkar_id = ${sahibkarId}::uuid AND a.aktiv = TRUE
       ORDER BY a.ad
    `;
  });
}

export async function getStockMovements(mehsul_id: string, limit = 30) {
  return withTenant(async () => {
    const rows = await prisma.anbar_hereketleri.findMany({
      where: { mehsul_id },
      orderBy: { yaradildi: "desc" },
      take: limit,
      include: {
        anbarlar: { select: { ad: true } },
        istifadeciler: { select: { ad_soyad: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      tarix: r.yaradildi,
      nov: r.nov,
      anbar_ad: r.anbarlar?.ad ?? "—",
      miqdar: Number(r.miqdar),
      qiymet: r.qiymet ? Number(r.qiymet) : null,
      edilen_ad: r.istifadeciler?.ad_soyad ?? null,
      qeyd: r.qeyd,
      ref_nov: r.ref_nov,
    }));
  });
}

export async function getRecentSalesForProduct(mehsul_id: string, limit = 20) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.$queryRaw<{
      sale_id: string;
      nomre: string;
      tarix: Date;
      miqdar: number;
      vahid_qiymet: number;
      cemi: number;
      musteri_ad: string | null;
    }[]>`
      SELECT ss.id::text AS sale_id, ss.nomre, ss.tarix,
             sls.miqdar::float AS miqdar,
             sls.vahid_qiymet::float AS vahid_qiymet,
             sls.cemi::float AS cemi,
             k.ad AS musteri_ad
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        LEFT JOIN kontragentler k ON k.id = ss.musteri_id
       WHERE sls.mehsul_id = ${mehsul_id}::uuid
         AND sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.status != 'legv'
       ORDER BY ss.tarix DESC
       LIMIT ${limit}
    `;
  });
}

export async function getProductSalesStats(mehsul_id: string) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [bu_ay, son_30, total] = await Promise.all([
      prisma.$queryRaw<{ qty: number; mebleg: number }[]>`
        SELECT COALESCE(SUM(sls.miqdar), 0)::float AS qty,
               COALESCE(SUM(sls.cemi), 0)::float AS mebleg
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
         WHERE sls.mehsul_id = ${mehsul_id}::uuid
           AND sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix >= ${monthStart}
           AND ss.status != 'legv'
      `,
      prisma.$queryRaw<{ qty: number; mebleg: number }[]>`
        SELECT COALESCE(SUM(sls.miqdar), 0)::float AS qty,
               COALESCE(SUM(sls.cemi), 0)::float AS mebleg
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
         WHERE sls.mehsul_id = ${mehsul_id}::uuid
           AND sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix >= CURRENT_DATE - INTERVAL '30 days'
           AND ss.status != 'legv'
      `,
      prisma.$queryRaw<{ qty: number; mebleg: number; sifaris_say: number }[]>`
        SELECT COALESCE(SUM(sls.miqdar), 0)::float AS qty,
               COALESCE(SUM(sls.cemi), 0)::float AS mebleg,
               COUNT(DISTINCT ss.id)::int AS sifaris_say
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
         WHERE sls.mehsul_id = ${mehsul_id}::uuid
           AND sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.status != 'legv'
      `,
    ]);

    return {
      bu_ay: bu_ay[0] ?? { qty: 0, mebleg: 0 },
      son_30: son_30[0] ?? { qty: 0, mebleg: 0 },
      toplam: total[0] ?? { qty: 0, mebleg: 0, sifaris_say: 0 },
    };
  });
}
