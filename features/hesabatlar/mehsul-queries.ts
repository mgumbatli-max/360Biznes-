import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { DateRange } from "./shared";

export type AbcRow = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  satilan: number;
  cemi: number;
  cumulative_pct: number;
  grade: "A" | "B" | "C";
};

export async function getAbcAnalysis(range: DateRange): Promise<AbcRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ mehsul_id: string; ad: string; kod: string | null; satilan: number; cemi: number }[]>`
      SELECT m.id::text AS mehsul_id, m.ad, m.kod,
             SUM(sls.miqdar)::float AS satilan,
             SUM(sls.cemi)::float AS cemi
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${range.from} AND ${range.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY m.id, m.ad, m.kod
       ORDER BY cemi DESC
    `;
    const total = rows.reduce((s, r) => s + Number(r.cemi), 0);
    if (total === 0) return rows.map((r) => ({ ...r, satilan: Number(r.satilan), cemi: Number(r.cemi), cumulative_pct: 0, grade: "C" as const }));

    let cum = 0;
    return rows.map((r) => {
      cum += Number(r.cemi);
      const pct = (cum / total) * 100;
      const grade: AbcRow["grade"] = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
      return {
        ...r,
        satilan: Number(r.satilan),
        cemi: Number(r.cemi),
        cumulative_pct: pct,
        grade,
      };
    });
  });
}

export type DeadStockRow = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  stok: number;
  deyer: number;
  son_satis: Date | null;
  gun_satissiz: number | null;
};

export async function getDeadStock90(limit = 50): Promise<DeadStockRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const rows = await prisma.$queryRaw<DeadStockRow[]>`
      SELECT m.id::text AS mehsul_id, m.ad, m.kod,
             COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0)::float AS stok,
             COALESCE((SELECT SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)) FROM stok s WHERE s.mehsul_id = m.id), 0)::float AS deyer,
             (SELECT MAX(ss.tarix) FROM satis_sifaris_satirlari sls
                JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
               WHERE sls.mehsul_id = m.id AND ss.status != 'legv') AS son_satis,
             (CURRENT_DATE - COALESCE((SELECT MAX(ss.tarix) FROM satis_sifaris_satirlari sls
                JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
               WHERE sls.mehsul_id = m.id AND ss.status != 'legv'), DATE '2000-01-01'))::int AS gun_satissiz
        FROM mehsullar m
       WHERE m.sahibkar_id = ${sahibkarId}::uuid
         AND m.aktiv = TRUE
         AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) > 0
         AND NOT EXISTS (
           SELECT 1 FROM satis_sifaris_satirlari sls
             JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
            WHERE sls.mehsul_id = m.id AND ss.tarix >= ${cutoff} AND ss.status != 'legv'
         )
       ORDER BY deyer DESC
       LIMIT ${limit}
    `;
    return rows.map((r) => ({
      ...r,
      stok: Number(r.stok),
      deyer: Number(r.deyer),
      gun_satissiz: r.gun_satissiz != null ? Number(r.gun_satissiz) : null,
    }));
  });
}

export type ProductPerf = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  satilan: number;
  gelir: number;
  xerc: number;
  mənfeet: number;
  margin_faiz: number | null;
};

export async function getTopMovers(range: DateRange, limit = 20): Promise<ProductPerf[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<ProductPerf[]>`
      SELECT m.id::text AS mehsul_id, m.ad, m.kod,
             SUM(sls.miqdar)::float AS satilan,
             SUM(sls.cemi)::float AS gelir,
             SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))::float AS xerc,
             (SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)))::float AS "mənfeet",
             CASE WHEN SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)) > 0
                  THEN ((SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))) / SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)) * 100)::float
                  ELSE NULL END AS margin_faiz
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${range.from} AND ${range.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY m.id, m.ad, m.kod
       ORDER BY satilan DESC
       LIMIT ${limit}
    `;
    return rows.map((r) => ({ ...r, satilan: Number(r.satilan), gelir: Number(r.gelir), xerc: Number(r.xerc), "mənfeet": Number(r["mənfeet"]) }));
  });
}

export async function getMostProfitable(range: DateRange, limit = 20): Promise<ProductPerf[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<ProductPerf[]>`
      SELECT m.id::text AS mehsul_id, m.ad, m.kod,
             SUM(sls.miqdar)::float AS satilan,
             SUM(sls.cemi)::float AS gelir,
             SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))::float AS xerc,
             (SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)))::float AS "mənfeet",
             CASE WHEN SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)) > 0
                  THEN ((SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))) / SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)) * 100)::float
                  ELSE NULL END AS margin_faiz
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${range.from} AND ${range.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY m.id, m.ad, m.kod
       ORDER BY "mənfeet" DESC NULLS LAST
       LIMIT ${limit}
    `;
    return rows.map((r) => ({ ...r, satilan: Number(r.satilan), gelir: Number(r.gelir), xerc: Number(r.xerc), "mənfeet": Number(r["mənfeet"]) }));
  });
}

export async function getSlowMovers(range: DateRange, limit = 20): Promise<ProductPerf[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<ProductPerf[]>`
      SELECT m.id::text AS mehsul_id, m.ad, m.kod,
             SUM(sls.miqdar)::float AS satilan,
             SUM(sls.cemi)::float AS gelir,
             SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0))::float AS xerc,
             (SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(sls.vahid_maya, m.alish_qiymeti, 0)))::float AS "mənfeet",
             NULL::float AS margin_faiz
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${range.from} AND ${range.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY m.id, m.ad, m.kod
      HAVING SUM(sls.miqdar) > 0
       ORDER BY satilan ASC
       LIMIT ${limit}
    `;
    return rows.map((r) => ({ ...r, satilan: Number(r.satilan), gelir: Number(r.gelir), xerc: Number(r.xerc), "mənfeet": Number(r["mənfeet"]) }));
  });
}

export type CategorySlice = { kateqoriya_ad: string; mehsul_say: number; satilan: number; gelir: number };

export async function getSalesByCategory(range: DateRange): Promise<CategorySlice[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<CategorySlice[]>`
      SELECT COALESCE(c.ad, '—') AS kateqoriya_ad,
             COUNT(DISTINCT m.id)::int AS mehsul_say,
             COALESCE(SUM(sls.miqdar), 0)::float AS satilan,
             COALESCE(SUM(sls.cemi), 0)::float AS gelir
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
        JOIN mehsullar m ON m.id = sls.mehsul_id
        LEFT JOIN kateqoriyalar c ON c.id = m.kateqoriya_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix BETWEEN ${range.from} AND ${range.to}
         AND ss.status != 'legv'
         AND ss.qaralama IS NOT TRUE
       GROUP BY c.ad
       ORDER BY gelir DESC
    `;
    return rows.map((r) => ({ ...r, mehsul_say: Number(r.mehsul_say), satilan: Number(r.satilan), gelir: Number(r.gelir) }));
  });
}

export type CategoryOption = { id: number; ad: string };
export type BrandOption = { id: number; ad: string };
export type AnbarOption = { id: number; ad: string };

export async function getReorderFilters(): Promise<{ categories: CategoryOption[]; brands: BrandOption[]; anbarlar: AnbarOption[] }> {
  return withTenant(async () => {
    const [c, b, a] = await Promise.all([
      prisma.kateqoriyalar.findMany({ select: { id: true, ad: true }, orderBy: { ad: "asc" } }).catch(() => [] as { id: number; ad: string }[]),
      prisma.markalar.findMany({ where: { aktiv: true }, select: { id: true, ad: true }, orderBy: { ad: "asc" } }).catch(() => [] as { id: number; ad: string }[]),
      prisma.anbarlar.findMany({ where: { aktiv: true }, select: { id: true, ad: true }, orderBy: { ad: "asc" } }).catch(() => [] as { id: number; ad: string }[]),
    ]);
    return { categories: c, brands: b, anbarlar: a };
  });
}

export type ReorderRow = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  stok: number;
  min_stok: number;
  kritik_stok: number | null;
};

export async function getReorderList(limit = 50): Promise<ReorderRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<ReorderRow[]>`
      SELECT m.id::text AS mehsul_id, m.ad, m.kod,
             COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0)::float AS stok,
             COALESCE(m.min_stok, 0)::float AS min_stok,
             m.kritik_stok::float AS kritik_stok
        FROM mehsullar m
       WHERE m.sahibkar_id = ${sahibkarId}::uuid
         AND m.aktiv = TRUE
         AND COALESCE(m.min_stok, 0) > 0
         AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) <= COALESCE(m.min_stok, 0)
       ORDER BY stok ASC
       LIMIT ${limit}
    `;
    return rows.map((r) => ({
      ...r,
      stok: Number(r.stok),
      min_stok: Number(r.min_stok),
      kritik_stok: r.kritik_stok != null ? Number(r.kritik_stok) : null,
    }));
  });
}
