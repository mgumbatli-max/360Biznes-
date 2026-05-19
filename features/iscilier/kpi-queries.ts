import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type KpiRow = {
  istifadeci_id: string;
  ad_soyad: string;
  vezife: string | null;
  satis_sayi: number;
  satis_meblegh: number;
  ort_cek: number;
  hedef: number;
  progress: number; // %
};

export async function getEmployeeKpiTable(monthStr?: string): Promise<{
  month: { il: number; ay: number };
  rows: KpiRow[];
  tenantTotal: { satis_sayi: number; satis_meblegh: number; ort_cek: number };
}> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const d = new Date();
    let il = d.getFullYear();
    let ay = d.getMonth() + 1;
    if (monthStr) {
      const [y, m] = monthStr.split("-").map(Number);
      if (y && m) {
        il = y;
        ay = m;
      }
    }
    const start = new Date(il, ay - 1, 1);
    const end = new Date(il, ay, 1);

    const [employees, salesAgg] = await Promise.all([
      prisma.istifadeciler.findMany({
        where: { aktiv: true, isden_cixdi: null, sahibkar_id: sahibkarId },
        select: { id: true, ad_soyad: true, vezife: true, aylik_maas: true },
        orderBy: { ad_soyad: "asc" },
      }),
      prisma.satis_sifarisleri.groupBy({
        by: ["satis_meneceri_id"],
        where: {
          sahibkar_id: sahibkarId,
          status: { not: "legv" },
          tarix: { gte: start, lt: end },
          satis_meneceri_id: { not: null },
        },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
    ]);

    const salesMap = new Map<string, { count: number; sum: number }>();
    let totalCount = 0;
    let totalSum = 0;
    for (const a of salesAgg) {
      if (!a.satis_meneceri_id) continue;
      const sum = Number(a._sum.son_mebleg ?? 0);
      salesMap.set(a.satis_meneceri_id, { count: a._count._all, sum });
      totalCount += a._count._all;
      totalSum += sum;
    }

    const rows: KpiRow[] = employees.map((e) => {
      const s = salesMap.get(e.id) ?? { count: 0, sum: 0 };
      const hedef = Number(e.aylik_maas ?? 0) * 10; // simple default target: 10x salary
      const progress = hedef > 0 ? Math.round((s.sum / hedef) * 100) : 0;
      return {
        istifadeci_id: e.id,
        ad_soyad: e.ad_soyad,
        vezife: e.vezife,
        satis_sayi: s.count,
        satis_meblegh: s.sum,
        ort_cek: s.count > 0 ? s.sum / s.count : 0,
        hedef,
        progress,
      };
    });
    rows.sort((a, b) => b.satis_meblegh - a.satis_meblegh);

    return {
      month: { il, ay },
      rows,
      tenantTotal: {
        satis_sayi: totalCount,
        satis_meblegh: totalSum,
        ort_cek: totalCount > 0 ? totalSum / totalCount : 0,
      },
    };
  });
}
