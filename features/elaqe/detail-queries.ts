import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export async function getContactSalesHistory(id: string, limit = 30) {
  return withTenant(async () =>
    prisma.satis_sifarisleri.findMany({
      where: { musteri_id: id },
      orderBy: { tarix: "desc" },
      take: limit,
      include: { _count: { select: { satis_sifaris_satirlari: true } } },
    })
  );
}

export async function getContactPurchaseHistory(id: string, limit = 30) {
  return withTenant(async () =>
    prisma.alis_sifarisleri.findMany({
      where: { techiazatci_id: id },
      orderBy: { tarix: "desc" },
      take: limit,
    })
  );
}

export type DebtTimelineRow = {
  ts: Date;
  kind: "sale" | "purchase" | "payment_in" | "payment_out" | "return";
  ref: string | null;
  ref_id: string | null;
  label: string;
  mebleg: number;
  // signed change to "borc" balance from our (sahibkar) perspective
  delta: number;
  qeyd: string | null;
};

/**
 * Builds a chronological debt timeline mixing sales, purchases, payments and returns.
 * Positive delta means contact owes us more; negative means less.
 */
export async function getContactDebtTimeline(id: string, limit = 200): Promise<DebtTimelineRow[]> {
  return withTenant(async () => {
    const [sales, purchases, ops, returns] = await Promise.all([
      prisma.satis_sifarisleri.findMany({
        where: { musteri_id: id, status: { not: "legv" } },
        select: { id: true, nomre: true, tarix: true, son_mebleg: true, odenilmis: true },
        orderBy: { tarix: "desc" },
        take: limit,
      }),
      prisma.alis_sifarisleri.findMany({
        where: { techiazatci_id: id, status: { not: "legv" } },
        select: { id: true, nomre: true, tarix: true, umumi_mebleg: true, odenilmis: true },
        orderBy: { tarix: "desc" },
        take: limit,
      }),
      prisma.finance_operations.findMany({
        where: { kontragent_id: id, status: "aktiv" },
        select: { id: true, type_kod: true, y_n: true, tarix: true, meblegh: true, qeyd: true },
        orderBy: { tarix: "desc" },
        take: limit,
      }),
      prisma.qaytarma_sifarisleri
        .findMany({
          where: { kontragent_id: id },
          select: { id: true, nomre: true, tarix: true, umumi_mebleg: true },
          orderBy: { tarix: "desc" },
          take: limit,
        })
        .catch(() => [] as { id: string; nomre: string; tarix: Date | null; umumi_mebleg: unknown }[]),
    ]);

    const items: DebtTimelineRow[] = [];
    for (const s of sales) {
      items.push({
        ts: s.tarix ?? new Date(0),
        kind: "sale",
        ref: s.nomre,
        ref_id: s.id,
        label: `Satış ${s.nomre}`,
        mebleg: Number(s.son_mebleg ?? 0),
        delta: Number(s.son_mebleg ?? 0) - Number(s.odenilmis ?? 0),
        qeyd: null,
      });
    }
    for (const p of purchases) {
      items.push({
        ts: p.tarix ?? new Date(0),
        kind: "purchase",
        ref: p.nomre,
        ref_id: p.id,
        label: `Alış ${p.nomre}`,
        mebleg: Number(p.umumi_mebleg ?? 0),
        delta: -(Number(p.umumi_mebleg ?? 0) - Number(p.odenilmis ?? 0)),
        qeyd: null,
      });
    }
    for (const f of ops) {
      const m = Number(f.meblegh ?? 0);
      const isIn = f.y_n === "daxil";
      items.push({
        ts: f.tarix ?? new Date(0),
        kind: isIn ? "payment_in" : "payment_out",
        ref: f.type_kod ?? null,
        ref_id: f.id,
        label: isIn ? "Bizə ödəniş" : "Bizdən ödəniş",
        mebleg: m,
        delta: isIn ? -m : m,
        qeyd: f.qeyd,
      });
    }
    for (const q of returns) {
      const m = Number(q.umumi_mebleg ?? 0);
      items.push({
        ts: (q.tarix ?? new Date(0)) as Date,
        kind: "return",
        ref: q.nomre,
        ref_id: q.id,
        label: `Qaytarma ${q.nomre}`,
        mebleg: m,
        delta: -m,
        qeyd: null,
      });
    }
    items.sort((a, b) => b.ts.getTime() - a.ts.getTime());
    return items.slice(0, limit);
  });
}

export async function getContactStats(id: string) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [salesAgg, purchAgg, notes] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { musteri_id: id, status: { not: "legv" } },
        _sum: { son_mebleg: true, odenilmis: true },
        _count: { _all: true },
      }),
      prisma.alis_sifarisleri.aggregate({
        where: { techiazatci_id: id, status: { not: "legv" } },
        _sum: { umumi_mebleg: true, odenilmis: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count
          FROM musteri_qeydleri
         WHERE sahibkar_id = ${sahibkarId}::uuid AND kontragent_id = ${id}::uuid
      `.catch(() => [{ count: 0n }]),
    ]);

    return {
      sales_count: salesAgg._count._all,
      sales_total: Number(salesAgg._sum.son_mebleg ?? 0),
      sales_paid: Number(salesAgg._sum.odenilmis ?? 0),
      purchase_count: purchAgg._count._all,
      purchase_total: Number(purchAgg._sum.umumi_mebleg ?? 0),
      purchase_paid: Number(purchAgg._sum.odenilmis ?? 0),
      notes_count: Number(notes[0]?.count ?? 0),
    };
  });
}

/* ------------------------------------------------------------------ */
/*   CUSTOMER 360° — Health score + KPIs                              */
/* ------------------------------------------------------------------ */

export type Customer360Kpis = {
  ltv: number;
  sales_total: number;
  borc: number;
  son_alish_gun: number | null;
  avg_check: number;
  nps: number | null;
  sales_count: number;
};

export async function getCustomer360Kpis(id: string): Promise<Customer360Kpis> {
  return withTenant(async () => {
    const [agg, lastSale, contact] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { musteri_id: id, status: { not: "legv" } },
        _sum: { son_mebleg: true, odenilmis: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.findFirst({
        where: { musteri_id: id, status: { not: "legv" } },
        orderBy: { tarix: "desc" },
        select: { tarix: true },
      }),
      prisma.kontragentler.findUnique({
        where: { id },
        select: { borc: true, musteri_reyting: true },
      }),
    ]);
    const count = agg._count._all;
    const total = Number(agg._sum.son_mebleg ?? 0);
    const avg = count > 0 ? total / count : 0;
    let sonGun: number | null = null;
    if (lastSale?.tarix) {
      sonGun = Math.max(0, Math.floor((Date.now() - new Date(lastSale.tarix).getTime()) / 86400000));
    }
    return {
      ltv: total,
      sales_total: total,
      sales_count: count,
      borc: Number(contact?.borc ?? 0),
      son_alish_gun: sonGun,
      avg_check: avg,
      nps: contact?.musteri_reyting ?? null,
    };
  });
}

export type CustomerHealth = {
  score: number; // 0-100
  factors: { label: string; score: number; weight: number }[];
  is_risk: boolean;
};

export async function getCustomerHealthScore(id: string): Promise<CustomerHealth> {
  return withTenant(async () => {
    const kpis = await getCustomer360Kpis(id);
    const contact = await prisma.kontragentler.findUnique({
      where: { id },
      select: { borc: true, borc_limiti: true, qara_siyahi: true, aktiv: true },
    });
    const borc = Number(contact?.borc ?? 0);
    const limit = contact?.borc_limiti !== null && contact?.borc_limiti !== undefined ? Number(contact.borc_limiti) : null;

    // 1) Satış tezliyi (0-100): 10+ satış = 100, 0 = 0
    const freqScore = Math.min(100, kpis.sales_count * 10);

    // 2) Son alış (0-100): <30 gün = 100, >180 gün = 0
    let recencyScore = 50;
    if (kpis.son_alish_gun === null) recencyScore = 0;
    else if (kpis.son_alish_gun <= 30) recencyScore = 100;
    else if (kpis.son_alish_gun >= 180) recencyScore = 0;
    else recencyScore = Math.max(0, 100 - ((kpis.son_alish_gun - 30) / 150) * 100);

    // 3) Borc durumu (0-100): 0 borc = 100; limit aşılıb = 0
    let debtScore = 100;
    if (borc > 0) {
      if (limit && limit > 0) {
        const istifade = borc / limit;
        debtScore = Math.max(0, 100 - istifade * 100);
      } else {
        debtScore = Math.max(0, 100 - Math.min(100, (borc / 1000) * 10));
      }
    }

    // 4) Qara siyahı / passiv penaltı
    let penalty = 0;
    if (contact?.qara_siyahi) penalty += 40;
    if (contact?.aktiv === false) penalty += 20;

    const raw = freqScore * 0.35 + recencyScore * 0.35 + debtScore * 0.3 - penalty;
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    return {
      score,
      factors: [
        { label: "Satış tezliyi", score: Math.round(freqScore), weight: 35 },
        { label: "Son alış", score: Math.round(recencyScore), weight: 35 },
        { label: "Borc durumu", score: Math.round(debtScore), weight: 30 },
      ],
      is_risk: score < 40,
    };
  });
}

/* ------------------------------------------------------------------ */
/*   CUSTOMER JOURNEY                                                 */
/* ------------------------------------------------------------------ */

export type JourneyEvent = {
  ts: Date;
  kind: "lead" | "sale" | "return" | "servis" | "elaqe" | "payment_in" | "payment_out";
  title: string;
  subtitle: string | null;
  amount: number | null;
  ref_id: string | null;
};

export async function getCustomerJourney(id: string, limit = 200): Promise<JourneyEvent[]> {
  return withTenant(async () => {
    const [leadsRow, sales, returns, servis, comms, ops] = await Promise.all([
      prisma.leads.findMany({
        where: { kontragent_id: id },
        select: { id: true, yaradildi: true, ad: true, menbe: true, status: true },
        orderBy: { yaradildi: "asc" },
      }),
      prisma.satis_sifarisleri.findMany({
        where: { musteri_id: id, status: { not: "legv" } },
        select: { id: true, nomre: true, tarix: true, son_mebleg: true, status: true },
        orderBy: { tarix: "desc" },
        take: limit,
      }),
      prisma.qaytarma_sifarisleri
        .findMany({
          where: { kontragent_id: id },
          select: { id: true, nomre: true, tarix: true, umumi_mebleg: true },
          orderBy: { tarix: "desc" },
          take: limit,
        })
        .catch(() => [] as { id: string; nomre: string; tarix: Date | null; umumi_mebleg: unknown }[]),
      prisma.servis_qeydleri
        .findMany({
          where: { musteri_id: id },
          select: { id: true, nomre: true, yaradildi: true, status: true, mehsul_ad: true },
          orderBy: { yaradildi: "desc" },
          take: limit,
        })
        .catch(() => [] as { id: string; nomre: string | null; yaradildi: Date | null; status: string | null; mehsul_ad: string | null }[]),
      prisma.contact_communications
        .findMany({
          where: { kontragent_id: id },
          select: { id: true, yaradildi: true, kanal: true, m_vzu: true, metn: true },
          orderBy: { yaradildi: "desc" },
          take: limit,
        })
        .catch(() => [] as { id: bigint | number; yaradildi: Date | null; kanal: string | null; m_vzu: string | null; metn: string | null }[]),
      prisma.finance_operations.findMany({
        where: { kontragent_id: id, status: "aktiv" },
        select: { id: true, tarix: true, y_n: true, meblegh: true, type_kod: true, qeyd: true },
        orderBy: { tarix: "desc" },
        take: limit,
      }),
    ]);

    const items: JourneyEvent[] = [];
    for (const l of leadsRow) {
      items.push({
        ts: l.yaradildi ?? new Date(0),
        kind: "lead",
        title: `Lead: ${l.ad ?? "—"}`,
        subtitle: [l.menbe, l.status].filter(Boolean).join(" · ") || null,
        amount: null,
        ref_id: l.id,
      });
    }
    for (const s of sales) {
      items.push({
        ts: s.tarix ?? new Date(0),
        kind: "sale",
        title: `Satış ${s.nomre}`,
        subtitle: s.status ?? null,
        amount: Number(s.son_mebleg ?? 0),
        ref_id: s.id,
      });
    }
    for (const r of returns) {
      items.push({
        ts: (r.tarix ?? new Date(0)) as Date,
        kind: "return",
        title: `Qaytarma ${r.nomre}`,
        subtitle: null,
        amount: Number(r.umumi_mebleg ?? 0),
        ref_id: r.id,
      });
    }
    for (const sv of servis) {
      items.push({
        ts: sv.yaradildi ?? new Date(0),
        kind: "servis",
        title: `Servis ${sv.nomre ?? ""}`,
        subtitle: [sv.mehsul_ad, sv.status].filter(Boolean).join(" · ") || null,
        amount: null,
        ref_id: sv.id,
      });
    }
    for (const c of comms) {
      items.push({
        ts: c.yaradildi ?? new Date(0),
        kind: "elaqe",
        title: c.m_vzu ?? c.kanal ?? "Əlaqə",
        subtitle: c.metn ? c.metn.slice(0, 100) : null,
        amount: null,
        ref_id: String(c.id),
      });
    }
    for (const f of ops) {
      const isIn = f.y_n === "daxil";
      items.push({
        ts: f.tarix ?? new Date(0),
        kind: isIn ? "payment_in" : "payment_out",
        title: isIn ? "Bizə ödəniş" : "Bizdən ödəniş",
        subtitle: [f.type_kod, f.qeyd].filter(Boolean).join(" · ") || null,
        amount: Number(f.meblegh ?? 0),
        ref_id: f.id,
      });
    }
    items.sort((a, b) => b.ts.getTime() - a.ts.getTime());
    return items.slice(0, limit);
  });
}

/* ------------------------------------------------------------------ */
/*   CONTACT DOCUMENTS — JSON-tag in `qeyd` field                      */
/* Format (one per line):                                              */
/*   [DOC:url|title|kateqoriya|tarix|bitme|nov|size|id]                 */
/* ------------------------------------------------------------------ */

export type ContactDocument = {
  id: string;
  url: string;
  title: string;
  kateqoriya: string; // "muqavile" | "id" | "vekalet" | "diger"
  tarix: string | null;
  bitme: string | null;
  nov: string | null;
  size: number | null;
};

const DOC_TAG_RE = /\[DOC:([^\]]+)\]/g;

export function parseContactDocuments(qeyd: string | null | undefined): ContactDocument[] {
  if (!qeyd) return [];
  const out: ContactDocument[] = [];
  const matches = qeyd.matchAll(DOC_TAG_RE);
  for (const m of matches) {
    const raw = m[1];
    const parts = raw.split("|");
    if (parts.length < 2) continue;
    const [url, title, kateqoriya, tarix, bitme, nov, sizeStr, id] = parts;
    if (!url || !title) continue;
    out.push({
      id: id || url,
      url,
      title,
      kateqoriya: kateqoriya || "diger",
      tarix: tarix || null,
      bitme: bitme || null,
      nov: nov || null,
      size: sizeStr ? Number(sizeStr) || null : null,
    });
  }
  return out;
}

export function stripDocTags(qeyd: string | null | undefined): string {
  if (!qeyd) return "";
  return qeyd.replace(DOC_TAG_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildDocTag(d: ContactDocument): string {
  const safe = (s: string | number | null) =>
    s === null || s === undefined ? "" : String(s).replace(/[|\]]/g, " ").trim();
  return `[DOC:${safe(d.url)}|${safe(d.title)}|${safe(d.kateqoriya)}|${safe(d.tarix)}|${safe(d.bitme)}|${safe(d.nov)}|${safe(d.size)}|${safe(d.id)}]`;
}

export async function getContactDocuments(id: string): Promise<ContactDocument[]> {
  return withTenant(async () => {
    const c = await prisma.kontragentler.findUnique({ where: { id }, select: { qeyd: true } });
    return parseContactDocuments(c?.qeyd);
  });
}

/* ------------------------------------------------------------------ */
/*   CUSTOMER SALES STATS — Detallı satış statistikası                 */
/* ------------------------------------------------------------------ */

export type CustomerSalesStats = {
  sales_count: number;
  sales_total: number;
  avg_check: number;
  last_sale_at: Date | null;
  last_sale_days_ago: number | null;
  top_category: { ad: string; sayi: number } | null;
  top_product: { ad: string; sayi: number } | null;
  bu_il_total: number;
  kechen_il_total: number;
  yoy_delta_pct: number | null;
};

export async function getCustomerSalesStats(musteri_id: string): Promise<CustomerSalesStats> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);

    const [agg, lastSale, topCat, topProd, buIl, kechenIl] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { musteri_id, status: { not: "legv" } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.findFirst({
        where: { musteri_id, status: { not: "legv" } },
        orderBy: { tarix: "desc" },
        select: { tarix: true },
      }),
      prisma.$queryRaw<{ ad: string; sayi: bigint }[]>`
        SELECT COALESCE(k.ad, 'Bilinmir') AS ad, COUNT(*)::bigint AS sayi
          FROM satis_sifaris_satirlari sat
          JOIN satis_sifarisleri s ON s.id = sat.sifaris_id
          LEFT JOIN mehsullar m ON m.id = sat.mehsul_id
          LEFT JOIN kateqoriyalar k ON k.id = m.kateqoriya_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid
           AND s.musteri_id = ${musteri_id}::uuid
           AND s.status <> 'legv'
         GROUP BY 1
         ORDER BY 2 DESC
         LIMIT 1
      `.catch(() => []),
      prisma.$queryRaw<{ ad: string; sayi: bigint }[]>`
        SELECT COALESCE(m.ad, 'Bilinmir') AS ad, COUNT(*)::bigint AS sayi
          FROM satis_sifaris_satirlari sat
          JOIN satis_sifarisleri s ON s.id = sat.sifaris_id
          LEFT JOIN mehsullar m ON m.id = sat.mehsul_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid
           AND s.musteri_id = ${musteri_id}::uuid
           AND s.status <> 'legv'
         GROUP BY 1
         ORDER BY 2 DESC
         LIMIT 1
      `.catch(() => []),
      prisma.satis_sifarisleri.aggregate({
        where: {
          musteri_id,
          status: { not: "legv" },
          tarix: { gte: thisYearStart, lt: nextYearStart },
        },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: {
          musteri_id,
          status: { not: "legv" },
          tarix: { gte: lastYearStart, lt: thisYearStart },
        },
        _sum: { son_mebleg: true },
      }),
    ]);

    const sales_count = agg._count._all;
    const sales_total = Number(agg._sum.son_mebleg ?? 0);
    const avg_check = sales_count > 0 ? sales_total / sales_count : 0;
    const last_sale_at = lastSale?.tarix ?? null;
    const last_sale_days_ago =
      last_sale_at !== null
        ? Math.max(0, Math.floor((Date.now() - new Date(last_sale_at).getTime()) / 86400000))
        : null;
    const bu_il_total = Number(buIl._sum.son_mebleg ?? 0);
    const kechen_il_total = Number(kechenIl._sum.son_mebleg ?? 0);
    const yoy_delta_pct =
      kechen_il_total > 0
        ? Math.round(((bu_il_total - kechen_il_total) / kechen_il_total) * 1000) / 10
        : bu_il_total > 0
          ? 100
          : null;

    return {
      sales_count,
      sales_total,
      avg_check,
      last_sale_at,
      last_sale_days_ago,
      top_category: topCat[0] ? { ad: topCat[0].ad, sayi: Number(topCat[0].sayi) } : null,
      top_product: topProd[0] ? { ad: topProd[0].ad, sayi: Number(topProd[0].sayi) } : null,
      bu_il_total,
      kechen_il_total,
      yoy_delta_pct,
    };
  });
}
