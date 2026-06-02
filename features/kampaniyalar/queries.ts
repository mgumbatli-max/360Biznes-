import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export async function getCampaigns(filter?: { status?: string; tip?: string; q?: string }) {
  return withTenant(async () => {
    const where: Record<string, unknown> = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.tip) where.tip = filter.tip;
    if (filter?.q) where.ad = { contains: filter.q, mode: "insensitive" };
    return prisma.campaigns.findMany({
      where,
      orderBy: [{ status: "asc" }, { yaradildi: "desc" }],
      include: { _count: { select: { campaign_usage: true, coupons: true } } },
    });
  });
}

export async function getCampaignDetail(id: string) {
  return withTenant(async () => {
    const c = await prisma.campaigns.findFirst({
      where: { id },
      include: {
        _count: { select: { campaign_usage: true, coupons: true } },
        coupons: { orderBy: { yaradildi: "desc" }, take: 50 },
      },
    });
    if (!c) return null;
    return c;
  });
}

export async function getCampaignStats() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const [total, aktiv, paused, expired] = await Promise.all([
      prisma.campaigns.count({}),
      prisma.campaigns.count({ where: { status: "active", OR: [{ bitme: null }, { bitme: { gt: now } }] } }),
      prisma.campaigns.count({ where: { status: "paused" } }),
      prisma.campaigns.count({ where: { OR: [{ status: "expired" }, { bitme: { lt: now } }] } }),
    ]);
    // Bu ay verilən endirim cəmi
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const usageThisMonth = await prisma.campaign_usage.aggregate({
      where: { istifade_de: { gte: monthStart } },
      _sum: { endirim_mebleg: true, bonus_qazanildi: true },
      _count: true,
    });
    return {
      total, aktiv, paused, expired,
      endirimCemi: Number(usageThisMonth._sum.endirim_mebleg ?? 0),
      bonusVerildi: Number(usageThisMonth._sum.bonus_qazanildi ?? 0),
      istifade30g: usageThisMonth._count,
      // Naive sahibkar id usage (kept silently in case Prisma extension fails)
      _meta: { sahibkarId },
    };
  });
}

/**
 * Loyalty kart sahibləri siyahısı — bütün kartlar, müştəri info ilə birgə.
 */
export async function getLoyaltyMembers(filter?: { tier?: string; q?: string }) {
  return withTenant(async () => {
    const where: Record<string, unknown> = { aktiv: true };
    if (filter?.tier) where.tier = filter.tier;
    if (filter?.q) {
      where.OR = [
        { kart_kod: { contains: filter.q, mode: "insensitive" } },
        { kontragentler: { ad: { contains: filter.q, mode: "insensitive" } } },
        { kontragentler: { telefon: { contains: filter.q } } },
      ];
    }
    const cards = await prisma.loyalty_cards.findMany({
      where,
      orderBy: [{ total_qazanc: "desc" }, { yaradildi: "desc" }],
      take: 200,
      include: {
        kontragentler: {
          select: { id: true, ad: true, telefon: true, email: true, aktiv: true },
        },
        _count: { select: { loyalty_tx: true } },
      },
    });
    return cards.map((c) => ({
      id: c.id,
      kart_kod: c.kart_kod,
      tier: c.tier,
      balans: Number(c.balans),
      total_qazanc: Number(c.total_qazanc),
      total_serf: Number(c.total_serf),
      son_alish_de: c.son_alish_de,
      yaradildi: c.yaradildi,
      tx_count: c._count.loyalty_tx,
      kontragent: c.kontragentler,
    }));
  });
}

/**
 * Bütün kuponların toplu siyahısı — coupon tipli kampaniyalardan.
 * Mərkəzi /kampaniyalar/kuponlar səhifəsində istifadə olunur.
 */
export async function getAllCoupons(filter?: { q?: string; only_active?: boolean }) {
  return withTenant(async () => {
    const where: Record<string, unknown> = {};
    if (filter?.only_active) where.aktiv = true;
    if (filter?.q) where.kod = { contains: filter.q.toUpperCase(), mode: "insensitive" };
    const rows = await prisma.coupons.findMany({
      where,
      orderBy: [{ yaradildi: "desc" }],
      take: 300,
      include: {
        campaigns: { select: { id: true, ad: true, tip: true, status: true, ikon: true } },
        kontragentler: { select: { id: true, ad: true } },
      },
    });
    return rows;
  });
}

export async function getCouponStats() {
  return withTenant(async () => {
    const now = new Date();
    const [total, aktiv, istifade, kampaniyalar] = await Promise.all([
      prisma.coupons.count({}),
      prisma.coupons.count({ where: { aktiv: true, OR: [{ bitme_tarixi: null }, { bitme_tarixi: { gt: now } }] } }),
      prisma.coupons.aggregate({ _sum: { current_uses: true } }),
      prisma.campaigns.count({ where: { tip: "coupon" } }),
    ]);
    return {
      total,
      aktiv,
      istifade: Number(istifade._sum.current_uses ?? 0),
      kampaniyalar,
    };
  });
}

/**
 * Loyalty leaderboard — top 5 müştəri (ömürlik qazanca görə).
 */
export async function getLoyaltyLeaderboard(limit = 5) {
  return withTenant(async () => {
    const top = await prisma.loyalty_cards.findMany({
      where: { aktiv: true },
      orderBy: { total_qazanc: "desc" },
      take: limit,
      include: {
        kontragentler: { select: { id: true, ad: true, telefon: true } },
      },
    });
    return top.map((c) => ({
      id: c.id,
      kart_kod: c.kart_kod,
      tier: c.tier,
      balans: Number(c.balans),
      total_qazanc: Number(c.total_qazanc),
      total_serf: Number(c.total_serf),
      son_alish_de: c.son_alish_de,
      kontragent: c.kontragentler,
    }));
  });
}

/**
 * Risk altında olan müştərilər — son alış 60+ gün əvvəl, lakin əvvəllər aktiv olub.
 */
export async function getInactiveLoyaltyMembers(limit = 10) {
  return withTenant(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const inactive = await prisma.loyalty_cards.findMany({
      where: {
        aktiv: true,
        total_qazanc: { gt: 0 },
        OR: [
          { son_alish_de: null },
          { son_alish_de: { lt: cutoff } },
        ],
      },
      orderBy: { total_qazanc: "desc" },
      take: limit,
      include: {
        kontragentler: { select: { id: true, ad: true, telefon: true } },
      },
    });
    return inactive
      .filter((c) => c.kontragentler !== null)
      .map((c) => ({
        id: c.id,
        kart_kod: c.kart_kod,
        tier: c.tier,
        balans: Number(c.balans),
        total_qazanc: Number(c.total_qazanc),
        son_alish_de: c.son_alish_de,
        kontragent: c.kontragentler,
      }));
  });
}

/**
 * Bu ayın bonus paylanışı statistikası.
 */
export async function getLoyaltyMonthStats() {
  return withTenant(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [qazanc, serf, yeniKart] = await Promise.all([
      prisma.loyalty_tx.aggregate({
        where: { yaradildi: { gte: monthStart }, mebleg: { gt: 0 } },
        _sum: { mebleg: true },
        _count: true,
      }),
      prisma.loyalty_tx.aggregate({
        where: { yaradildi: { gte: monthStart }, mebleg: { lt: 0 } },
        _sum: { mebleg: true },
        _count: true,
      }),
      prisma.loyalty_cards.count({
        where: { yaradildi: { gte: monthStart } },
      }),
    ]);
    return {
      qazancCemi: Number(qazanc._sum.mebleg ?? 0),
      qazancTxSayi: qazanc._count,
      serfCemi: Math.abs(Number(serf._sum.mebleg ?? 0)),
      serfTxSayi: serf._count,
      yeniKart,
    };
  });
}

export async function getLoyaltyOverview() {
  return withTenant(async () => {
    const [total, byTier, totalBalans, recentTx] = await Promise.all([
      prisma.loyalty_cards.count({ where: { aktiv: true } }),
      prisma.loyalty_cards.groupBy({
        by: ["tier"],
        where: { aktiv: true },
        _count: true,
      }),
      prisma.loyalty_cards.aggregate({
        where: { aktiv: true },
        _sum: { balans: true, total_qazanc: true },
      }),
      prisma.loyalty_tx.findMany({
        orderBy: { yaradildi: "desc" },
        take: 15,
        include: {
          loyalty_cards: {
            select: { kart_kod: true, kontragentler: { select: { ad: true } } },
          },
        },
      }),
    ]);
    return {
      total,
      tierDist: byTier.reduce<Record<string, number>>((acc, t) => {
        acc[t.tier] = t._count;
        return acc;
      }, {}),
      balansCemi: Number(totalBalans._sum.balans ?? 0),
      qazancCemi: Number(totalBalans._sum.total_qazanc ?? 0),
      recentTx,
    };
  });
}

/**
 * Hər kampaniyanın effektivlik göstəriciləri — ROI üçün.
 * Endirim verdiyi cəm məbləğ vs istifadə sayı və bonus.
 */
export async function getCampaignROI() {
  return withTenant(async () => {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const usages = await prisma.campaign_usage.groupBy({
      by: ["campaign_id"],
      where: { istifade_de: { gte: since } },
      _sum: { endirim_mebleg: true, bonus_qazanildi: true },
      _count: true,
    });
    if (usages.length === 0) return [];

    const ids = usages.map((u) => u.campaign_id);
    const campaigns = await prisma.campaigns.findMany({
      where: { id: { in: ids } },
      select: { id: true, ad: true, tip: true, ikon: true, status: true },
    });
    const map = new Map(campaigns.map((c) => [c.id, c]));

    const sales = await prisma.campaign_usage.findMany({
      where: { campaign_id: { in: ids }, istifade_de: { gte: since }, satis_id: { not: null } },
      include: { satis_sifarisleri: { select: { id: true, son_mebleg: true } } },
    });
    const revenueMap = new Map<string, number>();
    for (const s of sales) {
      const r = revenueMap.get(s.campaign_id) ?? 0;
      revenueMap.set(s.campaign_id, r + Number(s.satis_sifarisleri?.son_mebleg ?? 0));
    }

    return usages
      .map((u) => {
        const c = map.get(u.campaign_id);
        if (!c) return null;
        const endirim = Number(u._sum.endirim_mebleg ?? 0);
        const bonus = Number(u._sum.bonus_qazanildi ?? 0);
        const revenue = revenueMap.get(u.campaign_id) ?? 0;
        const cost = endirim + bonus;
        const roi = cost > 0 ? Math.round((revenue / cost) * 100) : 0;
        return {
          id: c.id, ad: c.ad, tip: c.tip, ikon: c.ikon, status: c.status,
          istifade: u._count,
          endirim,
          bonus,
          revenue,
          roi,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.revenue - a.revenue);
  });
}

export async function getGiftCards(filter?: { aktiv?: boolean }) {
  return withTenant(async () =>
    prisma.gift_cards.findMany({
      where: filter?.aktiv === undefined ? {} : { aktiv: filter.aktiv },
      orderBy: { yaradildi: "desc" },
      take: 100,
      include: { kontragentler: { select: { ad: true, telefon: true } } },
    }),
  );
}
