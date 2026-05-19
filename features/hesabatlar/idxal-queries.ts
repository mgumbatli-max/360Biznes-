import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { DateRange } from "./shared";

export type SupplierStat = {
  id: string;
  ad: string;
  sirket_adi: string | null;
  sayi: number;
  cemi: number;
  borc: number;
  odenilmis?: number;
  son_sifaris?: Date | null;
  ortalama?: number;
  vaxtinda_pct?: number;
};

export async function getImportStats(range: DateRange) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [agg, taxAgg] = await Promise.all([
      prisma.alis_sifarisleri.aggregate({
        where: { tarix: { gte: range.from, lte: range.to } },
        _sum: { umumi_mebleg: true, odenilmis: true, elave_xerc: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ vergi: number }[]>`
        SELECT COALESCE(SUM(mebleg_azn), 0)::float AS vergi
          FROM "xerclər" x
          JOIN xerc_kateqoriyalari xk ON xk.id = x.kateqoriya_id
         WHERE x.sahibkar_id = ${sahibkarId}::uuid
           AND x.tarix BETWEEN ${range.from} AND ${range.to}
           AND (LOWER(xk.ad) LIKE '%vergi%' OR LOWER(xk.ad) LIKE '%gömrük%' OR LOWER(xk.ad) LIKE '%gomruk%')
      `.catch(() => [{ vergi: 0 }]),
    ]);
    return {
      total_count: agg._count._all,
      total_amount: Number(agg._sum.umumi_mebleg ?? 0),
      paid: Number(agg._sum.odenilmis ?? 0),
      elave_xerc: Number(agg._sum.elave_xerc ?? 0),
      vergi_gomruk: Number(taxAgg[0]?.vergi ?? 0),
    };
  });
}

export async function getSupplierBreakdown(range: DateRange, limit = 20): Promise<SupplierStat[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<SupplierStat[]>`
      SELECT k.id::text, k.ad, k.sirket_adi,
             COUNT(asi.id)::int AS sayi,
             COALESCE(SUM(asi.umumi_mebleg), 0)::float AS cemi,
             COALESCE(SUM(COALESCE(asi.odenilmis, 0)), 0)::float AS odenilmis,
             COALESCE(SUM(asi.umumi_mebleg - COALESCE(asi.odenilmis, 0)), 0)::float AS borc,
             MAX(asi.tarix) AS son_sifaris,
             COALESCE(AVG(asi.umumi_mebleg), 0)::float AS ortalama,
             (COUNT(*) FILTER (WHERE asi.status = 'qebul_edildi')::float / NULLIF(COUNT(*), 0) * 100)::float AS vaxtinda_pct
        FROM alis_sifarisleri asi
        JOIN kontragentler k ON k.id = asi.techiazatci_id
       WHERE asi.sahibkar_id = ${sahibkarId}::uuid
         AND asi.tarix BETWEEN ${range.from} AND ${range.to}
       GROUP BY k.id, k.ad, k.sirket_adi
       ORDER BY cemi DESC
       LIMIT ${limit}
    `;
    return rows.map((r) => ({
      ...r,
      sayi: Number(r.sayi),
      cemi: Number(r.cemi),
      borc: Number(r.borc),
      odenilmis: Number(r.odenilmis ?? 0),
      ortalama: Number(r.ortalama ?? 0),
      vaxtinda_pct: r.vaxtinda_pct != null ? Number(r.vaxtinda_pct) : undefined,
    }));
  });
}

export type StatusSlice = { status: string; count: number; amount: number };

export async function getImportStatusBreakdown(range: DateRange): Promise<StatusSlice[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<StatusSlice[]>`
      SELECT COALESCE(status, '—') AS status,
             COUNT(*)::int AS count,
             COALESCE(SUM(umumi_mebleg), 0)::float AS amount
        FROM alis_sifarisleri
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix BETWEEN ${range.from} AND ${range.to}
       GROUP BY status
       ORDER BY count DESC
    `;
    return rows.map((r) => ({ ...r, count: Number(r.count), amount: Number(r.amount) }));
  });
}
