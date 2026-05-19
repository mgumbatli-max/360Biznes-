import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { isMockMode } from "@/lib/ai/anthropic";

export async function getChatHistory(limit = 50) {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    const rows = await prisma.ai_sohbet_loq.findMany({
      where: { istifadeci_id: istifadeciId },
      orderBy: { yaradildi: "asc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      prompt: r.prompt,
      cavab: r.cavab,
      yaradildi: r.yaradildi,
      is_mock: r.model === "mock",
    }));
  });
}

export function getMockStatus(): boolean {
  return isMockMode();
}

/**
 * Daily AI insight feed — derives a short list of plain-language insights
 * from cached business metrics. Real Claude integration may layer on top.
 */
export async function getDailyInsights() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(dayStart.getTime() - 24 * 3600 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      todaySales,
      yesterdaySales,
      monthSales,
      prevMonthSales,
      openTasks,
      negStock,
      noImage,
    ] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: dayStart }, status: { not: "legv" } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: yesterdayStart, lt: dayStart }, status: { not: "legv" } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: monthStart }, status: { not: "legv" } },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: prevMonthStart, lte: prevMonthEnd }, status: { not: "legv" } },
        _sum: { son_mebleg: true },
      }),
      prisma.sahibkar_tapshiriq.count({
        where: { sahibkar_id: sahibkarId, status: { in: ["acig", "isleyir"] } },
      }).catch(() => 0),
      prisma.$queryRaw<{ c: number }[]>`
        SELECT COUNT(*)::int AS c FROM stok WHERE sahibkar_id = ${sahibkarId}::uuid AND miqdar < 0
      `.catch(() => [{ c: 0 }]),
      prisma.mehsullar.count({
        where: { OR: [{ sekil_url: null }, { sekil_url: "" }], aktiv: true },
      }).catch(() => 0),
    ]);

    const today = Number(todaySales._sum.son_mebleg ?? 0);
    const yesterday = Number(yesterdaySales._sum.son_mebleg ?? 0);
    const month = Number(monthSales._sum.son_mebleg ?? 0);
    const prevMonth = Number(prevMonthSales._sum.son_mebleg ?? 0);
    const dayDelta = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : 0;
    const monthDelta = prevMonth > 0 ? ((month - prevMonth) / prevMonth) * 100 : 0;

    type Insight = {
      kind: "satis" | "stok" | "tapshiriq" | "data";
      seviyye: "info" | "warning" | "success" | "danger";
      title: string;
      detail: string;
    };
    const insights: Insight[] = [];

    if (today > 0) {
      insights.push({
        kind: "satis",
        seviyye: dayDelta >= 0 ? "success" : "warning",
        title: `Bu gün satış ${today.toFixed(0)} AZN`,
        detail:
          yesterday > 0
            ? `Dünənki ilə müqayisədə ${dayDelta >= 0 ? "+" : ""}${dayDelta.toFixed(1)}% ${
                dayDelta >= 0 ? "artım" : "azalma"
              } (${yesterday.toFixed(0)} AZN).`
            : "Dünən satış olmayıb — müqayisə yoxdur.",
      });
    } else {
      insights.push({
        kind: "satis",
        seviyye: "warning",
        title: "Bu gün hələ satış olmayıb",
        detail: "POS və ya marketplace sifarişlərini yoxlayın.",
      });
    }

    if (prevMonth > 0) {
      insights.push({
        kind: "satis",
        seviyye: monthDelta >= 0 ? "success" : "danger",
        title: `Ayın gəliri ${monthDelta >= 0 ? "+" : ""}${monthDelta.toFixed(1)}%`,
        detail: `Bu ay ${month.toFixed(0)} AZN · keçən ay ${prevMonth.toFixed(0)} AZN.`,
      });
    }

    const negCount = negStock[0]?.c ?? 0;
    if (negCount > 0) {
      insights.push({
        kind: "stok",
        seviyye: "danger",
        title: `${negCount} məhsulda mənfi stok`,
        detail: "Tezliklə inventar yoxlamasını işə salın.",
      });
    }
    if (noImage > 10) {
      insights.push({
        kind: "data",
        seviyye: "info",
        title: `${noImage} məhsulda şəkil yoxdur`,
        detail: "AI ilə şəkil generasiya etmək olar — data sağlamlığı səhifəsinə baxın.",
      });
    }
    if (openTasks > 0) {
      insights.push({
        kind: "tapshiriq",
        seviyye: openTasks > 10 ? "warning" : "info",
        title: `${openTasks} açıq tapşırıq`,
        detail:
          openTasks > 10
            ? "Tapşırıqlar yığılır — prioritetlərə yenidən baxın."
            : "Növbəti addımlarınızı planlayın.",
      });
    }

    return insights;
  });
}
