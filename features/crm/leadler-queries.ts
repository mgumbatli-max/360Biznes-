import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { LEAD_STAGES, type LeadStatus, type LeadCard, type LeadListRow } from "./types";

export { LEAD_STAGES };
export type { LeadStatus, LeadCard, LeadListRow };

export async function getLeadsByStage(filter?: { menecer_id?: string | null; menbe?: string | null }): Promise<Record<LeadStatus, LeadCard[]>> {
  return withTenant(async () => {
    const where: Record<string, unknown> = {};
    if (filter?.menecer_id) where.menecer_id = filter.menecer_id;
    if (filter?.menbe) where.menbe = filter.menbe;

    const rows = await prisma.leads.findMany({
      where,
      orderBy: [{ yenilendi: "desc" }],
      include: {
        istifadeciler_leads_menecer_idToistifadeciler: { select: { ad_soyad: true } },
      },
    });

    const stages: Record<LeadStatus, LeadCard[]> = {
      yeni: [], elaqe: [], muzakire: [], teklif: [], qazandi: [], itirdi: [],
    };
    for (const r of rows) {
      const status = (r.status ?? "yeni") as LeadStatus;
      if (!(status in stages)) continue;
      stages[status].push({
        id: r.id,
        ad: r.ad ?? "—",
        telefon: r.telefon,
        email: r.email,
        menbe: r.menbe,
        budce: Number(r.budce ?? 0),
        ehtimal: r.ehtimal ?? 50,
        status: status,
        novbeti_elaqe: r.novbeti_elaqe,
        menecer_ad: r.istifadeciler_leads_menecer_idToistifadeciler?.ad_soyad ?? null,
        prioritet: derivePrioritet(Number(r.budce ?? 0), r.ehtimal ?? 50),
        gunler_stage: r.yenilendi ? Math.max(0, Math.floor((Date.now() - new Date(r.yenilendi).getTime()) / 86400_000)) : 0,
      });
    }
    return stages;
  });
}

export async function getLeadsListRows(opts?: {
  q?: string;
  status?: LeadStatus | null;
  menecer_id?: string | null;
  menbe?: string | null;
}): Promise<LeadListRow[]> {
  return withTenant(async () => {
    const where: Record<string, unknown> = {};
    if (opts?.status) where.status = opts.status;
    // QA #13: status açıq verilməyibsə, silinmiş lead-ləri gizlət
    else where.status = { not: "silinib" };
    if (opts?.menecer_id) where.menecer_id = opts.menecer_id;
    if (opts?.menbe) where.menbe = opts.menbe;
    if (opts?.q && opts.q.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { ad: { contains: q, mode: "insensitive" } },
        { telefon: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await prisma.leads.findMany({
      where,
      orderBy: [{ yaradildi: "desc" }],
      include: {
        istifadeciler_leads_menecer_idToistifadeciler: { select: { ad_soyad: true } },
      },
      take: 500,
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad ?? "—",
      telefon: r.telefon,
      email: r.email,
      menbe: r.menbe,
      budce: Number(r.budce ?? 0),
      ehtimal: r.ehtimal ?? 50,
      status: (r.status ?? "yeni") as LeadStatus,
      novbeti_elaqe: r.novbeti_elaqe,
      menecer_ad: r.istifadeciler_leads_menecer_idToistifadeciler?.ad_soyad ?? null,
      yaradildi: r.yaradildi,
      prioritet: derivePrioritet(Number(r.budce ?? 0), r.ehtimal ?? 50),
    }));
  });
}

export async function getLeadById(id: string) {
  return withTenant(async () => {
    const r = await prisma.leads.findFirst({
      where: { id },
      include: {
        istifadeciler_leads_menecer_idToistifadeciler: { select: { ad_soyad: true } },
      },
    });
    return r;
  });
}

export async function getActiveUsers(): Promise<Array<{ id: string; ad_soyad: string }>> {
  return withTenant(async () => {
    const rows = await prisma.istifadeciler.findMany({
      where: { aktiv: true },
      select: { id: true, ad_soyad: true },
      orderBy: { ad_soyad: "asc" },
      take: 200,
    });
    return rows;
  });
}

function derivePrioritet(budce: number, ehtimal: number): "asagi" | "orta" | "yuksek" {
  const score = budce * (ehtimal / 100);
  if (score >= 3000) return "yuksek";
  if (score >= 500) return "orta";
  return "asagi";
}
