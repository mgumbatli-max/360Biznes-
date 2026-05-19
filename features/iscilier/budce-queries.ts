import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { listEntries } from "./hr-store";
import type { Vakansiya } from "./vakansiya-queries";

export type SobePlan = {
  sobe: string;
  planned_hire: number;
  planned_replace: number;
};

export type BudceSobe = {
  sobe: string;
  cari_headcount: number;
  cari_budget: number;
  planned_hire: number;
  planned_replace: number;
  acig_vakansiya: number;
  forecast_qtr: number; // current trend per quarter
};

/** Returns budget per sobe (using vezife as sobe proxy + vakansiya sobe data). */
export async function getBudce(): Promise<{
  sobeler: BudceSobe[];
  total_headcount: number;
  total_budget: number;
  total_planned: number;
}> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [employees, planRows, vaks] = await Promise.all([
      prisma.istifadeciler.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true, isden_cixdi: null },
        select: { id: true, vezife: true, aylik_maas: true },
      }),
      listEntries<SobePlan>("hr_sobe_plan"),
      listEntries<Vakansiya>("hr_vakansiya"),
    ]);

    // Use vezife as sobe (no separate sobe column). For more granularity user can edit name.
    const stats = new Map<string, { count: number; budget: number }>();
    for (const e of employees) {
      const sobe = e.vezife ?? "Digər";
      const cur = stats.get(sobe) ?? { count: 0, budget: 0 };
      cur.count++;
      cur.budget += Number(e.aylik_maas ?? 0);
      stats.set(sobe, cur);
    }

    const planMap = new Map<string, SobePlan>();
    for (const p of planRows) planMap.set(p.data.sobe, p.data);

    // Vakansiya by sobe
    const vakMap = new Map<string, number>();
    for (const v of vaks) {
      if (v.data.status === "acig") {
        vakMap.set(v.data.sobe, (vakMap.get(v.data.sobe) ?? 0) + 1);
      }
    }
    // Plan-only sobeler that have no employee yet
    for (const p of planRows) if (!stats.has(p.data.sobe)) stats.set(p.data.sobe, { count: 0, budget: 0 });
    for (const [sobe] of vakMap) if (!stats.has(sobe)) stats.set(sobe, { count: 0, budget: 0 });

    const sobeler: BudceSobe[] = Array.from(stats.entries()).map(([sobe, s]) => {
      const plan = planMap.get(sobe);
      return {
        sobe,
        cari_headcount: s.count,
        cari_budget: s.budget,
        planned_hire: plan?.planned_hire ?? 0,
        planned_replace: plan?.planned_replace ?? 0,
        acig_vakansiya: vakMap.get(sobe) ?? 0,
        forecast_qtr: Math.round(s.count * 1.1), // simple forecast +10%
      };
    }).sort((a, b) => b.cari_headcount - a.cari_headcount);

    return {
      sobeler,
      total_headcount: employees.length,
      total_budget: employees.reduce((s, e) => s + Number(e.aylik_maas ?? 0), 0),
      total_planned: sobeler.reduce((s, r) => s + r.planned_hire + r.planned_replace, 0),
    };
  });
}
