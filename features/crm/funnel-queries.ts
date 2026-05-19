import "server-only";
import { getLeadFunnel, type FunnelSlice } from "./dashboard-queries";

export { getLeadFunnel };
export type { FunnelSlice };

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type FunnelLeadDrill = {
  id: string;
  ad: string;
  telefon: string | null;
  menecer_ad: string | null;
  budce: number;
  yas_gun: number;
  yaradildi: Date | null;
};

export async function getFunnelLeadsForStage(
  status: string,
  filter?: { menecer_id?: string | null; menbe?: string | null; from?: Date; to?: Date }
): Promise<FunnelLeadDrill[]> {
  return withTenant(async () => {
    const where: Record<string, unknown> = { status };
    if (filter?.menecer_id) where.menecer_id = filter.menecer_id;
    if (filter?.menbe) where.menbe = filter.menbe;
    if (filter?.from || filter?.to) {
      where.yaradildi = {
        ...(filter?.from && { gte: filter.from }),
        ...(filter?.to && { lte: filter.to }),
      };
    }
    const rows = await prisma.leads.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 200,
      include: { istifadeciler_leads_menecer_idToistifadeciler: { select: { ad_soyad: true } } },
    });
    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad ?? "—",
      telefon: r.telefon,
      menecer_ad: r.istifadeciler_leads_menecer_idToistifadeciler?.ad_soyad ?? null,
      budce: Number(r.budce ?? 0),
      yas_gun: r.yaradildi ? Math.floor((now - r.yaradildi.getTime()) / 86400000) : 0,
      yaradildi: r.yaradildi,
    }));
  });
}

export async function getFunnelFilters() {
  return withTenant(async () => {
    const [users, menbeRows] = await Promise.all([
      prisma.istifadeciler.findMany({
        where: { aktiv: true },
        select: { id: true, ad_soyad: true },
        orderBy: { ad_soyad: "asc" },
      }),
      prisma.leads.groupBy({ by: ["menbe"], _count: { _all: true } }),
    ]);
    return {
      users,
      menbeler: menbeRows
        .map((r) => r.menbe)
        .filter((s): s is string => !!s)
        .sort(),
    };
  });
}
