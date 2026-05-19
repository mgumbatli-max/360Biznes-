import "server-only";
import { prismaUnscoped } from "@/lib/db/prisma";

export type PlatformKpis = {
  total_tenants: number;
  active_tenants: number;
  trial_tenants: number;
  paid_tenants: number;
  expiring_soon: number; // ≤7 days
  expired: number;
  mrr: number; // monthly recurring revenue
  arr: number; // annual recurring revenue
  total_users: number;
};

export async function getPlatformKpis(): Promise<PlatformKpis> {
  const now = new Date();
  const sevenDays = new Date(now);
  sevenDays.setDate(now.getDate() + 7);

  const [total, active, allAbune, expiring, expired, users] = await Promise.all([
    prismaUnscoped.sahibkarlar.count(),
    prismaUnscoped.sahibkarlar.count({ where: { status: "aktiv" } }),
    prismaUnscoped.abuneler.findMany({
      where: { status: "aktiv", bitme: { gte: now } },
      include: { abune_planlari: true },
    }),
    prismaUnscoped.abuneler.count({
      where: { status: "aktiv", bitme: { gte: now, lte: sevenDays } },
    }),
    prismaUnscoped.abuneler.count({
      where: { bitme: { lt: now } },
    }),
    prismaUnscoped.istifadeciler.count({ where: { aktiv: true } }),
  ]);

  let trial = 0;
  let paid = 0;
  let mrr = 0;
  for (const a of allAbune) {
    if (a.novu === "sinaq") trial++;
    else {
      paid++;
      mrr += Number(a.abune_planlari?.ayl_q_qiymet ?? 0);
    }
  }

  return {
    total_tenants: total,
    active_tenants: active,
    trial_tenants: trial,
    paid_tenants: paid,
    expiring_soon: expiring,
    expired,
    mrr,
    arr: mrr * 12,
    total_users: users,
  };
}

export type TenantRow = {
  id: string;
  ad: string;
  email: string;
  telefon: string | null;
  status: string;
  yaradildi: Date | null;
  seh_r: string | null;
  plan_kod: string | null;
  plan_ad: string | null;
  plan_qiymet: number;
  abune_status: string | null;
  abune_novu: string | null;
  abune_bitme: Date | null;
  istifadeci_sayi: number;
  mehsul_sayi: number;
  satish_cemi: number;
};

export async function getTenants(filter?: {
  status?: string;
  q?: string;
}): Promise<TenantRow[]> {
  const rows = await prismaUnscoped.sahibkarlar.findMany({
    where: {
      ...(filter?.status && filter.status !== "any" ? { status: filter.status } : {}),
      ...(filter?.q
        ? {
            OR: [
              { ad: { contains: filter.q, mode: "insensitive" } },
              { email: { contains: filter.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { yaradildi: "desc" },
    include: {
      abuneler: {
        orderBy: { yaradildi: "desc" },
        take: 1,
        include: { abune_planlari: true },
      },
      _count: { select: { istifadeciler: true, mehsullar: true, satis_sifarisleri: true } },
    },
  });

  // Aggregate sales totals per tenant
  const salesAgg = await prismaUnscoped.satis_sifarisleri.groupBy({
    by: ["sahibkar_id"],
    where: { status: { not: "legv" }, qaralama: { not: true } },
    _sum: { son_mebleg: true },
  });
  const byTenant = new Map(salesAgg.map((r) => [r.sahibkar_id, Number(r._sum.son_mebleg ?? 0)]));

  return rows.map((t) => {
    const a = t.abuneler[0];
    return {
      id: t.id,
      ad: t.ad,
      email: t.email,
      telefon: t.telefon,
      status: t.status ?? "aktiv",
      yaradildi: t.yaradildi,
      seh_r: t.seh_r,
      plan_kod: a?.abune_planlari?.kod ?? null,
      plan_ad: a?.abune_planlari?.ad ?? null,
      plan_qiymet: a ? Number(a.abune_planlari?.ayl_q_qiymet ?? 0) : 0,
      abune_status: a?.status ?? null,
      abune_novu: a?.novu ?? null,
      abune_bitme: a?.bitme ?? null,
      istifadeci_sayi: t._count.istifadeciler,
      mehsul_sayi: t._count.mehsullar,
      satish_cemi: byTenant.get(t.id) ?? 0,
    };
  });
}

export async function getTenantDetail(id: string) {
  const tenant = await prismaUnscoped.sahibkarlar.findUnique({
    where: { id },
    include: {
      abuneler: { include: { abune_planlari: true }, orderBy: { yaradildi: "desc" } },
      _count: { select: { istifadeciler: true, mehsullar: true, satis_sifarisleri: true, filiallar: true, anbarlar: true } },
    },
  });
  return tenant;
}

export async function getExpiringTrials(daysAhead = 7) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() + daysAhead);

  const rows = await prismaUnscoped.abuneler.findMany({
    where: {
      novu: "sinaq",
      status: "aktiv",
      bitme: { gte: now, lte: cutoff },
    },
    orderBy: { bitme: "asc" },
    include: {
      sahibkarlar: { select: { id: true, ad: true, email: true, telefon: true } },
      abune_planlari: { select: { ad: true, ayl_q_qiymet: true } },
    },
  });

  return rows.map((r) => ({
    sahibkar_id: r.sahibkar_id,
    sahibkar_ad: r.sahibkarlar.ad,
    email: r.sahibkarlar.email,
    telefon: r.sahibkarlar.telefon,
    bitme: r.bitme,
    plan_ad: r.abune_planlari?.ad ?? null,
    plan_qiymet: Number(r.abune_planlari?.ayl_q_qiymet ?? 0),
    days_left: Math.ceil((new Date(r.bitme).getTime() - now.getTime()) / (24 * 3600 * 1000)),
  }));
}

export async function getRevenueByPlan() {
  const rows = await prismaUnscoped.abuneler.findMany({
    where: { status: "aktiv", novu: { not: "sinaq" } },
    include: { abune_planlari: { select: { kod: true, ad: true, ayl_q_qiymet: true } } },
  });

  const byPlan = new Map<string, { ad: string; count: number; mrr: number }>();
  for (const r of rows) {
    const kod = r.abune_planlari?.kod ?? "—";
    const cur = byPlan.get(kod) ?? { ad: r.abune_planlari?.ad ?? kod, count: 0, mrr: 0 };
    cur.count += 1;
    cur.mrr += Number(r.abune_planlari?.ayl_q_qiymet ?? 0);
    byPlan.set(kod, cur);
  }

  return Array.from(byPlan.entries()).map(([kod, v]) => ({ kod, ...v }));
}
