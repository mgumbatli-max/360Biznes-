import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export type QaytarmaXulase = {
  cemi_say: number;
  cemi_mebleg: number;
  bu_ay_say: number;
  bu_ay_mebleg: number;
  satis_qaytarma_say: number;     // müştəri qaytardı
  alis_qaytarma_say: number;       // təchizatçıya qaytardıq
  qaytarma_faiz: number;           // satışların % neçəsi qaytarıldı
};

export type TopReturnedProduct = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  qaytarma_say: number;
  qaytarma_mebleg: number;
  son_qaytarma: Date | null;
};

export type ReturnReasonBucket = {
  sebeb: string;
  say: number;
  cemi_mebleg: number;
};

/**
 * Qaytarma analitikası — son 90 günün xülasəsi.
 */
export async function getQaytarmaXulase(days = 90): Promise<QaytarmaXulase> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [cemi, buAy, novler, totalSales] = await Promise.all([
      prisma.qaytarma_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: since } },
        _sum: { umumi_mebleg: true },
        _count: { _all: true },
      }),
      prisma.qaytarma_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart } },
        _sum: { umumi_mebleg: true },
        _count: { _all: true },
      }),
      prisma.qaytarma_sifarisleri.groupBy({
        by: ["nov"],
        where: { sahibkar_id: sahibkarId, tarix: { gte: since } },
        _count: { _all: true },
      }).catch(() => []),
      prisma.satis_sifarisleri.count({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: since },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
      }),
    ]);

    const satisQ = novler.find((n) => n.nov === "satis_qaytarma")?._count._all ?? 0;
    const alisQ = novler.find((n) => n.nov === "alis_qaytarma")?._count._all ?? 0;
    const cemiSay = cemi._count._all;
    const qaytarmaFaiz = totalSales > 0 ? (satisQ / totalSales) * 100 : 0;

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      cemi_say: cemiSay,
      cemi_mebleg: Number(cemi._sum.umumi_mebleg ?? 0) * s,
      bu_ay_say: buAy._count._all,
      bu_ay_mebleg: Number(buAy._sum.umumi_mebleg ?? 0) * s,
      satis_qaytarma_say: satisQ,
      alis_qaytarma_say: alisQ,
      qaytarma_faiz: qaytarmaFaiz,
    };
  });
}

/**
 * Top qaytarılan məhsullar — sahibkar problemli məhsulu görsün.
 */
export async function getTopReturnedProducts(days = 90, limit = 10): Promise<TopReturnedProduct[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await prisma.$queryRaw<
      Array<{ mehsul_id: string; ad: string; kod: string | null; qaytarma_say: bigint; qaytarma_mebleg: number; son_qaytarma: Date | null }>
    >`
      SELECT
        qs.mehsul_id::text AS mehsul_id,
        m.ad AS ad,
        m.kod AS kod,
        COUNT(DISTINCT qs.qaytarma_id)::bigint AS qaytarma_say,
        COALESCE(SUM(qs.miqdar * qs.vahid_qiymet), 0)::float AS qaytarma_mebleg,
        MAX(q.tarix) AS son_qaytarma
      FROM qaytarma_satirlari qs
      JOIN qaytarma_sifarisleri q ON q.id = qs.qaytarma_id
      JOIN mehsullar m ON m.id = qs.mehsul_id
      WHERE qs.sahibkar_id = ${sahibkarId}::uuid
        AND q.tarix >= ${since}
      GROUP BY qs.mehsul_id, m.ad, m.kod
      ORDER BY qaytarma_say DESC
      LIMIT ${limit}
    `.catch(() => []);

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return rows.map((r) => ({
      mehsul_id: r.mehsul_id,
      ad: r.ad,
      kod: r.kod,
      qaytarma_say: Number(r.qaytarma_say),
      qaytarma_mebleg: Number(r.qaytarma_mebleg) * s,
      son_qaytarma: r.son_qaytarma,
    }));
  });
}

/**
 * Qaytarma səbəbləri breakdown — keyfiyyət, ölçü, xidmət və s.
 */
export async function getReturnReasonBuckets(days = 90): Promise<ReturnReasonBucket[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await prisma.qaytarma_sifarisleri.groupBy({
      by: ["sebeb"],
      where: { sahibkar_id: sahibkarId, tarix: { gte: since } },
      _sum: { umumi_mebleg: true },
      _count: { _all: true },
    });

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return rows
      .map((r) => ({
        sebeb: r.sebeb ?? "—",
        say: r._count._all,
        cemi_mebleg: Number(r._sum.umumi_mebleg ?? 0) * s,
      }))
      .sort((a, b) => b.say - a.say)
      .slice(0, 15);
  });
}
