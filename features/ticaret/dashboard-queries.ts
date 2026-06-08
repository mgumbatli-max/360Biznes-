import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export type TradeKpis = {
  satish: {
    bugun_say: number;
    bugun_meb: number;
    bugun_xalis: number;
    ay_say: number;
    ay_meb: number;
    ay_xalis: number;
    kredit_say: number;
    kredit_borc: number;
  };
  alish: {
    bugun_say: number;
    bugun_meb: number;
    ay_say: number;
    ay_meb: number;
    aciq_say: number;
    aciq_meb: number;
  };
  qaytarma: {
    say: number;
    meb: number;
    gozleyen: number;
  };
  teklif: {
    aktiv: number;
    cevrildi: number;
    konversiya: number;
  };
};

export type DayBucket = { tarix: string; meb: number; say: number };
export type SellerRow = { id: string; ad: string; say: number; meb: number };
export type ProductRow = { id: string; ad: string; kod: string | null; miqdar: number; meb: number };

function asNumber(v: unknown) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  // Prisma Decimal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (v as any)?.toNumber === "function") return (v as any).toNumber();
  return Number(v);
}

type TradeKpisRaw = Omit<TradeKpis, "satish" | "alish" | "qaytarma"> & {
  satish: TradeKpis["satish"];
  alish: TradeKpis["alish"];
  qaytarma: TradeKpis["qaytarma"];
};

// Cache-li raw KPI — stealth-siz, 30s TTL (transactional data).
// Tag `dashboard:${sahibkarId}` artıq satış/alış action-larında invalidate olunur.
const fetchTradeKpisRawCached = (sahibkarId: string) =>
  unstable_cache(
    async (): Promise<TradeKpisRaw> => {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const [
        sBugun, sAy, kredit, aBugun, aAy, aAciq, qAy, qGoz, tAktiv, tCevr,
      ] = await Promise.all([
        prismaUnscoped.satis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: today }, qaralama: { not: true }, deleted_at: null, status: { notIn: ["legv", "qaytarilib"] } },
          _sum: { son_mebleg: true, xalis_meblegh: true },
          _count: { _all: true },
        }),
        prismaUnscoped.satis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, qaralama: { not: true }, deleted_at: null, status: { notIn: ["legv", "qaytarilib"] } },
          _sum: { son_mebleg: true, xalis_meblegh: true },
          _count: { _all: true },
        }),
        prismaUnscoped.satis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, odenis_nov: "nisye", qaralama: { not: true }, deleted_at: null, status: { notIn: ["legv", "qaytarilib"] } },
          _sum: { son_mebleg: true, odenilmis: true },
          _count: { _all: true },
        }),
        prismaUnscoped.alis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: today }, status: { not: "legv" } },
          _sum: { umumi_mebleg: true },
          _count: { _all: true },
        }),
        prismaUnscoped.alis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, status: { not: "legv" } },
          _sum: { umumi_mebleg: true },
          _count: { _all: true },
        }),
        prismaUnscoped.alis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, status: { in: ["gozlemede", "tesdiqlendi", "yolda"] } },
          _sum: { umumi_mebleg: true },
          _count: { _all: true },
        }),
        prismaUnscoped.qaytarma_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart } },
          _sum: { umumi_mebleg: true },
          _count: { _all: true },
        }),
        prismaUnscoped.qaytarma_sifarisleri.count({ where: { sahibkar_id: sahibkarId, status: "tesdiqlenmemis" } }),
        prismaUnscoped.teklifler.count({ where: { sahibkar_id: sahibkarId, status: { in: ["qaralama", "gonderildi", "qebul"] } } }),
        prismaUnscoped.teklifler.count({ where: { sahibkar_id: sahibkarId, satish_id: { not: null } } }),
      ]);

      const kreditBorc = asNumber(kredit._sum.son_mebleg) - asNumber(kredit._sum.odenilmis);
      const tTotal = tAktiv + tCevr;
      const konversiya = tTotal > 0 ? Math.round((tCevr / tTotal) * 100) : 0;

      return {
        satish: {
          bugun_say: sBugun._count._all,
          bugun_meb: asNumber(sBugun._sum.son_mebleg),
          bugun_xalis: asNumber(sBugun._sum.xalis_meblegh),
          ay_say: sAy._count._all,
          ay_meb: asNumber(sAy._sum.son_mebleg),
          ay_xalis: asNumber(sAy._sum.xalis_meblegh),
          kredit_say: kredit._count._all,
          kredit_borc: kreditBorc,
        },
        alish: {
          bugun_say: aBugun._count._all,
          bugun_meb: asNumber(aBugun._sum.umumi_mebleg),
          ay_say: aAy._count._all,
          ay_meb: asNumber(aAy._sum.umumi_mebleg),
          aciq_say: aAciq._count._all,
          aciq_meb: asNumber(aAciq._sum.umumi_mebleg),
        },
        qaytarma: {
          say: qAy._count._all,
          meb: asNumber(qAy._sum.umumi_mebleg),
          gozleyen: qGoz,
        },
        teklif: { aktiv: tAktiv, cevrildi: tCevr, konversiya },
      };
    },
    ["trade-kpis", sahibkarId],
    { revalidate: 30, tags: [`dashboard:${sahibkarId}`, `satis:${sahibkarId}`, `alis:${sahibkarId}`] },
  );

export async function getTradeKpis(): Promise<TradeKpis> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [raw, stealth] = await Promise.all([
      fetchTradeKpisRawCached(sahibkarId)(),
      getStealthState(),
    ]);
    const s = stealth.aktiv ? stealth.scale : 1;
    return {
      satish: {
        ...raw.satish,
        bugun_meb: raw.satish.bugun_meb * s,
        bugun_xalis: raw.satish.bugun_xalis * s,
        ay_meb: raw.satish.ay_meb * s,
        ay_xalis: raw.satish.ay_xalis * s,
        kredit_borc: raw.satish.kredit_borc * s,
      },
      alish: {
        ...raw.alish,
        bugun_meb: raw.alish.bugun_meb * s,
        ay_meb: raw.alish.ay_meb * s,
        aciq_meb: raw.alish.aciq_meb * s,
      },
      qaytarma: { ...raw.qaytarma, meb: raw.qaytarma.meb * s },
      teklif: raw.teklif,
    };
  });
}

export async function getSalesByDay(days = 30): Promise<DayBucket[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ tarix: Date; meb: number; say: number }[]>`
      SELECT
        tarix::date          AS tarix,
        COALESCE(SUM(son_mebleg), 0)::float AS meb,
        COUNT(*)::int        AS say
      FROM satis_sifarisleri
      WHERE sahibkar_id = ${sahibkarId}::uuid
        AND tarix >= CURRENT_DATE - (${days}::int - 1)
        AND COALESCE(status, '') NOT IN ('legv', 'qaytarilib') AND deleted_at IS NULL
        AND COALESCE(qaralama, false) = false
      GROUP BY 1
      ORDER BY 1
    `;
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return rows.map((r) => ({
      tarix: new Date(r.tarix).toISOString().slice(0, 10),
      meb: Number(r.meb) * s,
      say: Number(r.say),
    }));
  });
}

export async function getTopSellers(limit = 5): Promise<SellerRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ id: string; ad: string; say: number; meb: number }[]>`
      SELECT
        u.id::text             AS id,
        u.ad_soyad             AS ad,
        COUNT(s.id)::int       AS say,
        COALESCE(SUM(s.son_mebleg), 0)::float AS meb
      FROM satis_sifarisleri s
      JOIN istifadeciler u
        ON u.id = COALESCE(s.satis_meneceri_id, s.yaradan_id)
      WHERE s.sahibkar_id = ${sahibkarId}::uuid
        AND s.tarix >= date_trunc('month', CURRENT_DATE)
        AND COALESCE(s.status, '') NOT IN ('legv', 'qaytarilib') AND s.deleted_at IS NULL
        AND COALESCE(s.qaralama, false) = false
      GROUP BY 1, 2
      ORDER BY meb DESC
      LIMIT ${limit}
    `;
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return rows.map((r) => ({ id: r.id, ad: r.ad, say: Number(r.say), meb: Number(r.meb) * s }));
  });
}

export async function getTopProducts(limit = 5): Promise<ProductRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      { id: string; ad: string; kod: string | null; miqdar: number; meb: number }[]
    >`
      SELECT
        m.id::text          AS id,
        m.ad                AS ad,
        m.kod               AS kod,
        COALESCE(SUM(ss.miqdar), 0)::float AS miqdar,
        COALESCE(SUM(ss.cemi), 0)::float   AS meb
      FROM satis_sifaris_satirlari ss
      JOIN satis_sifarisleri s ON s.id = ss.sifaris_id
      JOIN mehsullar m ON m.id = ss.mehsul_id
      WHERE s.sahibkar_id = ${sahibkarId}::uuid
        AND s.tarix >= date_trunc('month', CURRENT_DATE)
        AND COALESCE(s.status, '') NOT IN ('legv', 'qaytarilib') AND s.deleted_at IS NULL
        AND COALESCE(s.qaralama, false) = false
      GROUP BY 1, 2, 3
      ORDER BY meb DESC
      LIMIT ${limit}
    `;
    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      kod: r.kod,
      miqdar: Number(r.miqdar),
      meb: Number(r.meb) * s,
    }));
  });
}

// === NEW: SMART INSIGHTS ===

export type TradeInsight = {
  novu: "alarm" | "fursat" | "tovsiye" | "ugur";
  basliq: string;
  tesvir: string;
  metric?: string;
  href?: string;
};

export async function getTradeInsights(): Promise<TradeInsight[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const insights: TradeInsight[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d7 = new Date(today);
    d7.setDate(d7.getDate() - 7);
    const d14 = new Date(today);
    d14.setDate(d14.getDate() - 14);
    const d30 = new Date(today);
    d30.setDate(d30.getDate() - 30);
    const d60 = new Date(today);
    d60.setDate(d60.getDate() - 60);

    // 1) Sales trend (this week vs last week)
    const [sale7, sale14] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: d7 }, status: { not: "legv" } },
        _sum: { umumi_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: d14, lt: d7 }, status: { not: "legv" } },
        _sum: { umumi_mebleg: true },
        _count: { _all: true },
      }),
    ]);
    const cur = Number(sale7._sum.umumi_mebleg ?? 0);
    const prev = Number(sale14._sum.umumi_mebleg ?? 0);
    if (prev > 0) {
      const pct = ((cur - prev) / prev) * 100;
      if (pct >= 15) {
        insights.push({
          novu: "ugur",
          basliq: "Satışlar artır",
          tesvir: `Bu həftə keçən həftədən ${pct.toFixed(0)}% çoxdur (${sale7._count._all} vs ${sale14._count._all} satış).`,
          metric: `+${pct.toFixed(0)}%`,
          href: "/ticaret/satislar",
        });
      } else if (pct <= -15) {
        insights.push({
          novu: "alarm",
          basliq: "Satışlar azalır",
          tesvir: `Bu həftə keçən həftədən ${Math.abs(pct).toFixed(0)}% azdır. Marketinq və ya endirim kampaniyası nəzərdən keçirilməlidir.`,
          metric: `${pct.toFixed(0)}%`,
          href: "/hesabatlar/satis",
        });
      }
    }

    // 2) Dormant customers (active 30-60 days ago, not in last 30 days)
    const dormantCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT s.musteri_id)::bigint AS count
      FROM satis_sifarisleri s
      WHERE s.sahibkar_id = ${sahibkarId}::uuid
        AND s.musteri_id IS NOT NULL
        AND s.tarix >= ${d60}
        AND s.tarix < ${d30}
        AND NOT EXISTS (
          SELECT 1 FROM satis_sifarisleri s2
          WHERE s2.sahibkar_id = ${sahibkarId}::uuid
            AND s2.musteri_id = s.musteri_id
            AND s2.tarix >= ${d30}
        )
    `;
    const dormant = Number(dormantCount[0]?.count ?? 0);
    if (dormant > 0) {
      insights.push({
        novu: "tovsiye",
        basliq: "Yuxu rejimində müştərilər",
        tesvir: `${dormant} müştəri 30+ gündür alış etmir, daha əvvəl aktiv idi. SMS/zəng kampaniyası göndər.`,
        metric: `${dormant}`,
        href: "/elaqe?segment=passiv",
      });
    }

    // 3) Pending returns
    const pendingReturns = await prisma.qaytarma_sifarisleri.count({
      where: { sahibkar_id: sahibkarId, status: { in: ["tesdiqlenmemis", "gozleyir"] } },
    });
    if (pendingReturns >= 3) {
      insights.push({
        novu: "alarm",
        basliq: "Qaytarmalar bağlanmamış",
        tesvir: `${pendingReturns} qaytarma gözləyir. Müştəri narazılığını artır — təcili nəzərdən keçir.`,
        metric: `${pendingReturns}`,
        href: "/ticaret/qaytarma",
      });
    }

    // 4) Overdue credit sales
    const overdueSales = await prisma.$queryRaw<Array<{ count: bigint; total: number }>>`
      SELECT COUNT(*)::bigint AS count,
             COALESCE(SUM(s.son_mebleg - s.odenilmis), 0)::float AS total
      FROM satis_sifarisleri s
      WHERE s.sahibkar_id = ${sahibkarId}::uuid
        AND s.odenis_nov = 'borc'
        AND s.son_mebleg > s.odenilmis + 0.001
        AND s.tarix < CURRENT_DATE - INTERVAL '30 days'
    `;
    const overdue = Number(overdueSales[0]?.count ?? 0);
    const overdueAmount = Number(overdueSales[0]?.total ?? 0);
    if (overdue > 0) {
      insights.push({
        novu: "alarm",
        basliq: "Gecikən borclar",
        tesvir: `${overdue} kreditli satış 30+ gündür ödənilmir. Cəm: ${new Intl.NumberFormat("az-AZ").format(Math.round(overdueAmount))} ₼`,
        metric: `${overdue}`,
        href: "/maliyye/debitor",
      });
    }

    // 5) High-margin opportunity — products selling well but low stock
    const topMarginLow = await prisma.$queryRaw<Array<{ ad: string; profit: number }>>`
      SELECT m.ad,
             SUM(ss.miqdar * (ss.vahid_qiymet - COALESCE(m.alish_qiymeti, 0)))::float AS profit
      FROM satis_sifaris_satirlari ss
      JOIN satis_sifarisleri s ON s.id = ss.sifaris_id
      JOIN mehsullar m ON m.id = ss.mehsul_id
      LEFT JOIN stok st ON st.mehsul_id = m.id
      WHERE s.sahibkar_id = ${sahibkarId}::uuid
        AND s.tarix >= ${d30}
        AND COALESCE(s.status, '') NOT IN ('legv', 'qaytarilib') AND s.deleted_at IS NULL
      GROUP BY m.id, m.ad
      HAVING SUM(COALESCE(st.miqdar, 0)) <= 5 AND SUM(ss.miqdar) >= 3
      ORDER BY profit DESC
      LIMIT 1
    `;
    if (topMarginLow.length > 0 && topMarginLow[0].profit > 0) {
      insights.push({
        novu: "fursat",
        basliq: "Yüksək mənfəətli məhsul azalır",
        tesvir: `«${topMarginLow[0].ad}» son 30 gündə ${Math.round(topMarginLow[0].profit)} ₼ mənfəət gətirib, amma stok 5-dən aşağı. Sifariş et.`,
        href: "/anbar/satinalma",
      });
    }

    // 6) Margin loss — satıldı amma maya altı / min qiymət altı (son 7 gün)
    const [mayaAlti, minAlti] = await Promise.all([
      prisma.satis_sifarisleri.count({
        where: { sahibkar_id: sahibkarId, tarix: { gte: d7 }, maya_alti: true, status: { not: "legv" } },
      }),
      prisma.satis_sifarisleri.count({
        where: { sahibkar_id: sahibkarId, tarix: { gte: d7 }, min_qiymet_alti: true, status: { not: "legv" } },
      }),
    ]);
    if (mayaAlti > 0) {
      insights.push({
        novu: "alarm",
        basliq: "Maya altı satışlar",
        tesvir: `Son 7 gündə ${mayaAlti} satış maya qiymətindən aşağı edilib. Endirim siyasətini nəzərdən keçir.`,
        metric: `${mayaAlti}`,
        href: "/ticaret/satislar?borc=&status=&filtr=maya_alti",
      });
    } else if (minAlti >= 3) {
      insights.push({
        novu: "tovsiye",
        basliq: "Minimum qiymət altı satışlar",
        tesvir: `Son 7 gündə ${minAlti} satış minimum qiymətdən aşağıdır. Satıcılarla müzakirə et.`,
        metric: `${minAlti}`,
        href: "/ticaret/satislar",
      });
    }

    // 7) Dead stock — stokda olub, 60+ gündür satılmayan məhsul sayı
    const deadStock = await prisma.$queryRaw<Array<{ count: bigint; total_qiymet: number }>>`
      SELECT COUNT(*)::bigint AS count,
             COALESCE(SUM(st.miqdar * COALESCE(m.alish_qiymeti, 0)), 0)::float AS total_qiymet
      FROM mehsullar m
      JOIN stok st ON st.mehsul_id = m.id AND st.miqdar > 0
      WHERE m.sahibkar_id = ${sahibkarId}::uuid
        AND m.aktiv = true
        AND NOT EXISTS (
          SELECT 1 FROM satis_sifaris_satirlari ss
          JOIN satis_sifarisleri s ON s.id = ss.sifaris_id
          WHERE ss.mehsul_id = m.id
            AND s.tarix >= ${d60}
            AND COALESCE(s.status, '') NOT IN ('legv', 'qaytarilib') AND s.deleted_at IS NULL
        )
    `;
    const deadCount = Number(deadStock[0]?.count ?? 0);
    const deadValue = Number(deadStock[0]?.total_qiymet ?? 0);
    if (deadCount >= 5 && deadValue > 0) {
      insights.push({
        novu: "tovsiye",
        basliq: "Anbarda dayanan mal",
        tesvir: `${deadCount} məhsul 60+ gündür satılmır. Mayası ~${new Intl.NumberFormat("az-AZ").format(Math.round(deadValue))} ₼ dondurulub. Endirim və ya geri qaytarma planla.`,
        metric: `${deadCount}`,
        href: "/anbar/mehsullar?sort=son_satis&dir=asc",
      });
    }

    // 8) New customer first purchase — son 7 gündə ilk alışını edən yeni müştərilər
    const newCustomerFirst = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT s.musteri_id)::bigint AS count
      FROM satis_sifarisleri s
      WHERE s.sahibkar_id = ${sahibkarId}::uuid
        AND s.musteri_id IS NOT NULL
        AND s.tarix >= ${d7}
        AND COALESCE(s.status, '') NOT IN ('legv', 'qaytarilib') AND s.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM satis_sifarisleri s2
          WHERE s2.sahibkar_id = ${sahibkarId}::uuid
            AND s2.musteri_id = s.musteri_id
            AND s2.tarix < ${d7}
        )
    `;
    const newCustomers = Number(newCustomerFirst[0]?.count ?? 0);
    if (newCustomers > 0) {
      insights.push({
        novu: "ugur",
        basliq: "Yeni müştərilər",
        tesvir: `Son 7 gündə ${newCustomers} müştəri ilk dəfə alış edib. Loyallığı qoru — minnətdarlıq mesajı və ya endirim kuponu göndər.`,
        metric: `+${newCustomers}`,
        href: "/elaqe?segment=yeni",
      });
    }

    // 9) VIP dormant — VIP müştəri 14+ gündür alış etmir (amma ümumi tarixçəsi var)
    const vipDormant = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT k.id)::bigint AS count
      FROM kontragentler k
      WHERE k.sahibkar_id = ${sahibkarId}::uuid
        AND k.qiymet_tipi = 'vip'
        AND k.aktiv = true
        AND EXISTS (
          SELECT 1 FROM satis_sifarisleri s
          WHERE s.sahibkar_id = ${sahibkarId}::uuid
            AND s.musteri_id = k.id
            AND s.tarix < ${d14}
        )
        AND NOT EXISTS (
          SELECT 1 FROM satis_sifarisleri s2
          WHERE s2.sahibkar_id = ${sahibkarId}::uuid
            AND s2.musteri_id = k.id
            AND s2.tarix >= ${d14}
        )
    `;
    const vipDormantCount = Number(vipDormant[0]?.count ?? 0);
    if (vipDormantCount > 0) {
      insights.push({
        novu: "tovsiye",
        basliq: "VIP müştərilər passivləşir",
        tesvir: `${vipDormantCount} VIP müştəri 14+ gündür alış etmir. Şəxsi zəng və ya eksklüziv təklif göndər — itirməyə bilərsən.`,
        metric: `${vipDormantCount}`,
        href: "/elaqe?qiymet_tipi=vip",
      });
    }

    return insights.slice(0, 8);
  });
}

/** Sales funnel: leads → quotes → sales (current month) */
export async function getSalesFunnel() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [leads, quotes, sales, lost] = await Promise.all([
      prisma.kontragentler.count({
        where: { sahibkar_id: sahibkarId, nov: "musteri", yaradildi: { gte: monthStart } },
      }),
      prisma.teklifler.count({
        where: { sahibkar_id: sahibkarId, yaradildi: { gte: monthStart }, status: { not: "legv" } },
      }),
      prisma.satis_sifarisleri.count({
        where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, status: { in: ["tesdiq", "tamamlandi", "yeni"] } },
      }),
      prisma.satis_sifarisleri.count({
        where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, status: "legv" },
      }),
    ]);

    return { leads, quotes, sales, lost };
  });
}
