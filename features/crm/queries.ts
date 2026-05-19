import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { LEAD_STAGES, type LeadStatus, type LeadCard, type TemplateRow } from "./types";

export { LEAD_STAGES };
export type { LeadStatus, LeadCard, TemplateRow };

// Re-export from modular query files
export { getLeadsByStage, getLeadsListRows, getActiveUsers, getLeadById } from "./leadler-queries";

export async function getTemplates(): Promise<TemplateRow[]> {
  return withTenant(async () => {
    const rows = await prisma.mesaj_sablonlari.findMany({ orderBy: { ad: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      hadisi: r.hadisi,
      kanal: r.kanal ?? "whatsapp",
      movzu: r.movzu,
      matn: r.matn,
      deyisenler: r.deyisenler ?? [],
      aktiv: r.aktiv ?? true,
    }));
  });
}

export async function getCrmStats() {
  return withTenant(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setDate(today.getDate() + 1);

    const [open, won, lost, todayFollowUp, templates] = await Promise.all([
      prisma.leads.count({ where: { status: { notIn: ["qazandi", "itirdi"] } } }),
      prisma.leads.count({ where: { status: "qazandi" } }),
      prisma.leads.count({ where: { status: "itirdi" } }),
      prisma.leads.count({ where: { novbeti_elaqe: { gte: today, lt: todayEnd } } }),
      prisma.mesaj_sablonlari.count(),
    ]);

    return {
      open_leads: open,
      won_leads: won,
      lost_leads: lost,
      today_followup: todayFollowUp,
      conversion: open + won > 0 ? (won / (won + lost + open)) * 100 : 0,
      templates_count: templates,
    };
  });
}
