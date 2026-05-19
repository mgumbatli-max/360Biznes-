import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type KpiRange = "month" | "last_month" | "90d" | "year";

export function rangeBounds(range: KpiRange): { from: Date; to: Date } {
  const now = new Date();
  if (range === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
  if (range === "last_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
  }
  if (range === "90d") {
    const from = new Date();
    from.setDate(from.getDate() - 90);
    return { from, to: now };
  }
  return { from: new Date(now.getFullYear(), 0, 1), to: now };
}

export type UserKpi = {
  user_id: string;
  ad_soyad: string;
  yeni_lead: number;
  qazandi: number;
  itirdi: number;
  cevrilme: number;
  ortalama_deal: number;
  ortalama_mudet_gun: number;
};

export async function getUserKpi(range: KpiRange): Promise<UserKpi[]> {
  return withTenant(async () => {
    const { from, to } = rangeBounds(range);
    const leads = await prisma.leads.findMany({
      where: { yaradildi: { gte: from, lte: to }, menecer_id: { not: null } },
      select: {
        menecer_id: true,
        status: true,
        budce: true,
        yaradildi: true,
        yenilendi: true,
        istifadeciler_leads_menecer_idToistifadeciler: { select: { ad_soyad: true } },
      },
    });

    const grouped = new Map<string, UserKpi & { _wonValues: number[]; _durations: number[]; _wonCount: number }>();
    for (const l of leads) {
      const uid = l.menecer_id ?? "";
      if (!uid) continue;
      const name = l.istifadeciler_leads_menecer_idToistifadeciler?.ad_soyad ?? "—";
      if (!grouped.has(uid)) {
        grouped.set(uid, {
          user_id: uid,
          ad_soyad: name,
          yeni_lead: 0,
          qazandi: 0,
          itirdi: 0,
          cevrilme: 0,
          ortalama_deal: 0,
          ortalama_mudet_gun: 0,
          _wonValues: [],
          _durations: [],
          _wonCount: 0,
        });
      }
      const g = grouped.get(uid)!;
      g.yeni_lead += 1;
      if (l.status === "qazandi") {
        g.qazandi += 1;
        g._wonValues.push(Number(l.budce ?? 0));
        if (l.yaradildi && l.yenilendi) {
          const d = (l.yenilendi.getTime() - l.yaradildi.getTime()) / 86400_000;
          g._durations.push(Math.max(0, d));
        }
      } else if (l.status === "itirdi") {
        g.itirdi += 1;
      }
    }

    return Array.from(grouped.values())
      .map((g) => ({
        ...g,
        cevrilme: g.yeni_lead > 0 ? (g.qazandi / g.yeni_lead) * 100 : 0,
        ortalama_deal: g._wonValues.length > 0 ? g._wonValues.reduce((a, b) => a + b, 0) / g._wonValues.length : 0,
        ortalama_mudet_gun: g._durations.length > 0 ? g._durations.reduce((a, b) => a + b, 0) / g._durations.length : 0,
      }))
      .sort((a, b) => b.qazandi - a.qazandi);
  });
}

export async function getCrmKpiSummary(range: KpiRange) {
  return withTenant(async () => {
    const { from, to } = rangeBounds(range);
    const [yeni, qazandi, itirdi, dealAgg] = await Promise.all([
      prisma.leads.count({ where: { yaradildi: { gte: from, lte: to } } }),
      prisma.leads.count({ where: { yenilendi: { gte: from, lte: to }, status: "qazandi" } }),
      prisma.leads.count({ where: { yenilendi: { gte: from, lte: to }, status: "itirdi" } }),
      prisma.leads.aggregate({
        where: { yenilendi: { gte: from, lte: to }, status: "qazandi" },
        _sum: { budce: true },
        _avg: { budce: true },
      }),
    ]);

    return {
      yeni_lead: yeni,
      qazandi,
      itirdi,
      cevrilme: yeni > 0 ? (qazandi / yeni) * 100 : 0,
      cem_deyer: Number(dealAgg._sum.budce ?? 0),
      ortalama_deal: Number(dealAgg._avg.budce ?? 0),
    };
  });
}
