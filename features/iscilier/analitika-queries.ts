import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type AnalitikaData = {
  headcount_trend: Array<{ ay: string; aktiv: number; yeni: number; cixmis: number }>;
  turnover_pct: number;
  by_vezife: Array<{ ad: string; say: number; min: number; max: number; median: number; avg: number }>;
  by_role: Array<{ ad: string; say: number }>;
  birthdays_this_month: Array<{ id: string; ad_soyad: string; vezife: string | null; tarix: Date }>;
  yearly_costs: {
    maas: number;
    bonus: number;
    cerime: number;
    treninq: number;
  };
};

export async function getAnalitika(): Promise<AnalitikaData> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const monthsBack = 11; // 12-month window

    // Headcount trend (snapshot per month)
    const trendStartDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const employeesAll = await prisma.istifadeciler.findMany({
      where: { sahibkar_id: sahibkarId },
      select: { id: true, ise_baslama: true, isden_cixdi: true, yaradildi: true },
    });

    const headcount_trend: Array<{ ay: string; aktiv: number; yeni: number; cixmis: number }> = [];
    for (let i = 0; i <= monthsBack; i++) {
      const monthStart = new Date(trendStartDate.getFullYear(), trendStartDate.getMonth() + i, 1);
      const monthEnd = new Date(trendStartDate.getFullYear(), trendStartDate.getMonth() + i + 1, 1);
      let aktiv = 0;
      let yeni = 0;
      let cixmis = 0;
      for (const e of employeesAll) {
        const started = e.ise_baslama ?? e.yaradildi;
        if (!started) continue;
        const startedDate = new Date(started);
        const leftDate = e.isden_cixdi ? new Date(e.isden_cixdi) : null;
        if (startedDate < monthEnd && (!leftDate || leftDate >= monthEnd)) aktiv++;
        if (startedDate >= monthStart && startedDate < monthEnd) yeni++;
        if (leftDate && leftDate >= monthStart && leftDate < monthEnd) cixmis++;
      }
      headcount_trend.push({
        ay: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
        aktiv,
        yeni,
        cixmis,
      });
    }

    // Turnover: last 12 months left / current active
    const last12mStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const left12m = employeesAll.filter((e) => e.isden_cixdi && new Date(e.isden_cixdi) >= last12mStart).length;
    const currentActive = employeesAll.filter((e) => !e.isden_cixdi).length || 1;
    const turnover_pct = Math.round((left12m / currentActive) * 100);

    // Salary stats by vezife
    const empWithVezife = await prisma.istifadeciler.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true, isden_cixdi: null, vezife: { not: null } },
      select: { vezife: true, aylik_maas: true },
    });
    const byVezifeMap = new Map<string, number[]>();
    for (const e of empWithVezife) {
      if (!e.vezife) continue;
      const list = byVezifeMap.get(e.vezife) ?? [];
      list.push(Number(e.aylik_maas ?? 0));
      byVezifeMap.set(e.vezife, list);
    }
    const by_vezife = Array.from(byVezifeMap.entries())
      .map(([ad, list]) => {
        const sorted = [...list].sort((a, b) => a - b);
        const median = sorted.length % 2
          ? sorted[Math.floor(sorted.length / 2)]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
        return {
          ad,
          say: list.length,
          min: sorted[0] ?? 0,
          max: sorted[sorted.length - 1] ?? 0,
          median,
          avg: list.reduce((s, n) => s + n, 0) / list.length,
        };
      })
      .sort((a, b) => b.say - a.say);

    // By role
    const roleAgg = await prisma.istifadeciler.groupBy({
      by: ["rol_id"],
      where: { sahibkar_id: sahibkarId, aktiv: true, isden_cixdi: null },
      _count: { _all: true },
    });
    const roles = await prisma.roles.findMany({
      where: { id: { in: roleAgg.map((r) => r.rol_id ?? 0).filter((n) => n > 0) } },
      select: { id: true, ad: true },
    });
    const by_role = roleAgg
      .map((r) => ({
        ad: roles.find((x) => x.id === r.rol_id)?.ad ?? "—",
        say: r._count._all,
      }))
      .sort((a, b) => b.say - a.say);

    // Birthdays this month
    const allActive = await prisma.istifadeciler.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true, isden_cixdi: null, dogum_tarixi: { not: null } },
      select: { id: true, ad_soyad: true, vezife: true, dogum_tarixi: true },
    });
    const thisMonth = now.getMonth();
    const birthdays_this_month = allActive
      .filter((e) => e.dogum_tarixi && new Date(e.dogum_tarixi).getMonth() === thisMonth)
      .map((e) => ({
        id: e.id,
        ad_soyad: e.ad_soyad,
        vezife: e.vezife,
        tarix: e.dogum_tarixi!,
      }))
      .sort((a, b) => new Date(a.tarix).getDate() - new Date(b.tarix).getDate());

    // Yearly costs
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
    const [maasAgg, bonusAgg, ceriemAgg] = await Promise.all([
      prisma.maas_hesablamalar.aggregate({
        where: { sahibkar_id: sahibkarId, status: "odenilib" },
        _sum: { son_meblegh: true, manual_bonus: true, kpi_bonus: true, cerime: true },
      }),
      Promise.resolve(null),
      Promise.resolve(null),
    ]);
    void bonusAgg;
    void ceriemAgg;
    const treninqRows = await prisma.ayarlar
      .findMany({
        where: { sahibkar_id: sahibkarId, qrup: "hr_treninq_qeyd" },
      })
      .catch(() => []);
    let treninq_xerc = 0;
    const treninqDefRows = await prisma.ayarlar
      .findMany({ where: { sahibkar_id: sahibkarId, qrup: "hr_treninq" } })
      .catch(() => []);
    const treninqDefMap = new Map<string, number>();
    for (const t of treninqDefRows) {
      try {
        const v = JSON.parse(t.deyer ?? "{}");
        treninqDefMap.set(t.acar, Number(v.xerc ?? 0));
      } catch {
        /* */
      }
    }
    for (const q of treninqRows) {
      try {
        const v = JSON.parse(q.deyer ?? "{}");
        if (v.status === "tamam") {
          treninq_xerc += treninqDefMap.get(v.treninq_id) ?? 0;
        }
      } catch {
        /* */
      }
    }
    void yearStart;
    void yearEnd;

    return {
      headcount_trend,
      turnover_pct,
      by_vezife,
      by_role,
      birthdays_this_month,
      yearly_costs: {
        maas: Number(maasAgg._sum.son_meblegh ?? 0),
        bonus: Number(maasAgg._sum.manual_bonus ?? 0) + Number(maasAgg._sum.kpi_bonus ?? 0),
        cerime: Number(maasAgg._sum.cerime ?? 0),
        treninq: treninq_xerc,
      },
    };
  });
}
