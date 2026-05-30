import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type CrmDashboardKpi = {
  active_leads: number;
  this_month_leads: number;
  conversion: number;
  avg_deal: number;
  open_tasks: number;
  followup_this_week: number;
  won_leads: number;
  lost_leads: number;
};

const fetchCrmKpisCached = (sahibkarId: string) =>
  unstable_cache(
    async (): Promise<CrmDashboardKpi> => {
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      const [active, won, lost, monthNew, dealAgg, openTasks, followupWeek] = await Promise.all([
        prismaUnscoped.leads.count({ where: { sahibkar_id: sahibkarId, status: { notIn: ["qazandi", "itirdi"] } } }),
        prismaUnscoped.leads.count({ where: { sahibkar_id: sahibkarId, status: "qazandi" } }),
        prismaUnscoped.leads.count({ where: { sahibkar_id: sahibkarId, status: "itirdi" } }),
        prismaUnscoped.leads.count({ where: { sahibkar_id: sahibkarId, yaradildi: { gte: startMonth } } }),
        prismaUnscoped.leads.aggregate({
          where: { sahibkar_id: sahibkarId, status: "qazandi" },
          _avg: { budce: true },
        }),
        prismaUnscoped.tapshiriqlar.count({ where: { sahibkar_id: sahibkarId, status: { notIn: ["tamamlandi", "legv"] } } }).catch(() => 0),
        prismaUnscoped.leads.count({
          where: {
            sahibkar_id: sahibkarId,
            novbeti_elaqe: { gte: new Date(), lt: endOfWeek },
          },
        }),
      ]);

      const totalLeads = active + won + lost;
      return {
        active_leads: active,
        this_month_leads: monthNew,
        conversion: totalLeads > 0 ? (won / totalLeads) * 100 : 0,
        avg_deal: Number(dealAgg._avg.budce ?? 0),
        open_tasks: openTasks,
        followup_this_week: followupWeek,
        won_leads: won,
        lost_leads: lost,
      };
    },
    ["crm-dashboard-kpis", sahibkarId],
    { revalidate: 60, tags: [`crm:${sahibkarId}`, `dashboard:${sahibkarId}`] },
  );

export async function getDashboardKpis(): Promise<CrmDashboardKpi> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchCrmKpisCached(sahibkarId)();
  });
}

export type LeadSourceSlice = { menbe: string; count: number };

export async function getLeadSourceBreakdown(): Promise<LeadSourceSlice[]> {
  return withTenant(async () => {
    const rows = await prisma.leads.groupBy({
      by: ["menbe"],
      _count: { _all: true },
      orderBy: { _count: { menbe: "desc" } },
    });
    return rows
      .map((r) => ({
        menbe: r.menbe ?? "naməlum",
        count: r._count._all,
      }))
      .slice(0, 8);
  });
}

export type LeadSourceAnalytics = {
  menbe: string;
  total: number;
  won: number;
  lost: number;
  conversion: number; // %
  revenue: number;
  cost: number; // platzhalter, user üzərinə əlavə edə bilər
  roi: number; // revenue / cost
};

/**
 * Hər lead qaynağı üçün dönüşüm % və ROI hesablaması.
 * Xərc (`cost`) hələlik 0-dır — ayarlardan plug-in edilə bilər.
 */
export async function getLeadSourceAnalytics(): Promise<LeadSourceAnalytics[]> {
  return withTenant(async () => {
    const rows = await prisma.leads.groupBy({
      by: ["menbe", "status"],
      _count: { _all: true },
      _sum: { budce: true },
    });
    const map = new Map<string, LeadSourceAnalytics>();
    for (const r of rows) {
      const key = r.menbe ?? "naməlum";
      const ex = map.get(key) ?? { menbe: key, total: 0, won: 0, lost: 0, conversion: 0, revenue: 0, cost: 0, roi: 0 };
      ex.total += r._count._all;
      if (r.status === "qazandi") {
        ex.won += r._count._all;
        ex.revenue += Number(r._sum.budce ?? 0);
      }
      if (r.status === "itirdi") ex.lost += r._count._all;
      map.set(key, ex);
    }
    const out: LeadSourceAnalytics[] = [];
    for (const v of map.values()) {
      v.conversion = v.total > 0 ? (v.won / v.total) * 100 : 0;
      v.roi = v.cost > 0 ? v.revenue / v.cost : 0;
      out.push(v);
    }
    out.sort((a, b) => b.total - a.total);
    return out.slice(0, 10);
  });
}

export type FunnelSlice = {
  status: string;
  count: number;
  value: number;
};

export async function getLeadFunnel(filter?: { menecer_id?: string | null; menbe?: string | null; from?: Date; to?: Date }): Promise<FunnelSlice[]> {
  return withTenant(async () => {
    const where: Record<string, unknown> = {};
    if (filter?.menecer_id) where.menecer_id = filter.menecer_id;
    if (filter?.menbe) where.menbe = filter.menbe;
    if (filter?.from || filter?.to) {
      where.yaradildi = {
        ...(filter?.from && { gte: filter.from }),
        ...(filter?.to && { lte: filter.to }),
      };
    }
    const rows = await prisma.leads.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { budce: true },
    });
    const stages = ["yeni", "elaqe", "muzakire", "teklif", "qazandi", "itirdi"];
    const byStatus = new Map(rows.map((r) => [r.status ?? "yeni", { count: r._count._all, value: Number(r._sum.budce ?? 0) }]));
    return stages.map((s) => ({
      status: s,
      count: byStatus.get(s)?.count ?? 0,
      value: byStatus.get(s)?.value ?? 0,
    }));
  });
}

export type DailyLeadPoint = { date: string; count: number };

export async function getDailyLeadsLast30(): Promise<DailyLeadPoint[]> {
  return withTenant(async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - 29);
    const rows = await prisma.leads.findMany({
      where: { yaradildi: { gte: from } },
      select: { yaradildi: true },
    });
    const map = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of rows) {
      if (!r.yaradildi) continue;
      const key = new Date(r.yaradildi).toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  });
}

export type CrmActivityRow = {
  id: string;
  kind: "lead" | "inbox" | "task";
  title: string;
  subtitle: string | null;
  ts: Date | null;
  status: string | null;
};

export async function getRecentActivity(limit = 20): Promise<CrmActivityRow[]> {
  return withTenant(async () => {
    const [leads, inbox] = await Promise.all([
      prisma.leads.findMany({
        orderBy: { yaradildi: "desc" },
        take: limit,
        select: { id: true, ad: true, menbe: true, status: true, yaradildi: true },
      }),
      prisma.inbox_sohbetler.findMany({
        orderBy: { son_mesaj_zamani: "desc" },
        take: limit,
        select: { id: true, display_ad: true, telefon: true, son_mesaj: true, son_mesaj_zamani: true, kanal: true },
      }).catch(() => []),
    ]);
    const items: CrmActivityRow[] = [];
    for (const l of leads) {
      items.push({
        id: `lead-${l.id}`,
        kind: "lead",
        title: `Yeni lead: ${l.ad ?? "—"}`,
        subtitle: l.menbe ?? null,
        ts: l.yaradildi,
        status: l.status,
      });
    }
    for (const c of inbox) {
      items.push({
        id: `inbox-${c.id}`,
        kind: "inbox",
        title: `${c.display_ad ?? c.telefon ?? "Müştəri"} → ${c.kanal}`,
        subtitle: c.son_mesaj ?? null,
        ts: c.son_mesaj_zamani,
        status: null,
      });
    }
    return items
      .sort((a, b) => (b.ts?.getTime() ?? 0) - (a.ts?.getTime() ?? 0))
      .slice(0, limit);
  });
}
