import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { isMockMode } from "@/lib/ai/anthropic";

export async function getChatHistory(limit = 50, mode: "owner" | "employee" = "employee") {
  return withTenant(async () => {
    const { istifadeciId, rolAd } = requireTenant();
    const effective = mode === "owner" && rolAd === "sahibkar" ? "owner" : "employee";
    const kanal = effective === "owner" ? "sahibkar" : "panel";
    const rows = await prisma.ai_sohbet_loq.findMany({
      where: { istifadeci_id: istifadeciId, kanal },
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
 * Cari sahibkarın əsas biznes göstəricilərini AI sistem prompt-u üçün
 * mətn blokuna yığır. AI-nin sənin biznesinə dair konkret rəqəmlərlə cavab
 * verə bilməsi üçün hər sual əvvəli inject olunur.
 */
/**
 * Cari istifadəçi üçün biznes kontekstini AI prompt-una yığır.
 *
 * Mode:
 *  - "owner" — yalnız sahibkar rolu üçün (/sahibkar/ai). Tam KPI, kassa,
 *    mənfəət, maaş, məxfi qeydlər kontekstə qoşulur.
 *  - "employee" — hər istifadəçi (/ai). Yalnız öz performansı + ümumi modul
 *    göstəriciləri. Sahibkar rolunda da bu mode-da öz şəxsi datasını və
 *    ümumi məhsul/anbar/müştəri sayını görür — gəlir/mənfəət YOX.
 *
 * Sahibkar rolu olub "employee" mode çağırsa (məs. /ai-yə girəndə),
 * yenə də sahibkar-yalnız bloklar gizlənir.
 */
export async function getBusinessContext(mode: "owner" | "employee" = "employee"): Promise<string> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolAd } = requireTenant();
    // owner mode yalnız "sahibkar" rolu üçün; başqa hər kəs avtomatik employee düşür
    const isOwner = mode === "owner" && rolAd === "sahibkar";
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const sahibkar = await prisma.sahibkarlar.findUnique({
      where: { id: sahibkarId },
      select: { ad: true },
    }).catch(() => null);
    const valyuta = "AZN";
    const fmt = (n: number) => n.toLocaleString("az-AZ", { maximumFractionDigits: 0 });

    const lines: string[] = [
      `<biznes_konteksti>`,
      `Şirkət: ${sahibkar?.ad ?? "—"}`,
      `Tarix: ${now.toLocaleDateString("az-AZ", { day: "2-digit", month: "long", year: "numeric" })}`,
      `İstifadəçi rolu: ${isOwner ? "Sahibkar (tam giriş)" : "Əməkdaş (məhdud giriş)"}`,
      ``,
    ];

    if (isOwner) {
      // ─── SAHIBKAR — tam biznes göstəriciləri
      const [
        todaySales, monthSales, prevMonthSales,
        productCount, customerCount, openTasks,
        cashBalance, topProducts, lowStock, debtors,
        partiyaCemi, opexAylik,
      ] = await Promise.all([
        prisma.satis_sifarisleri.aggregate({
          where: { tarix: { gte: dayStart }, status: { not: "legv" } },
          _sum: { son_mebleg: true }, _count: { _all: true },
        }),
        prisma.satis_sifarisleri.aggregate({
          where: { tarix: { gte: monthStart }, status: { not: "legv" } },
          _sum: { son_mebleg: true }, _count: { _all: true },
        }),
        prisma.satis_sifarisleri.aggregate({
          where: { tarix: { gte: prevMonthStart, lte: prevMonthEnd }, status: { not: "legv" } },
          _sum: { son_mebleg: true },
        }),
        prisma.mehsullar.count({ where: { aktiv: true } }).catch(() => 0),
        prisma.kontragentler.count().catch(() => 0),
        prisma.sahibkar_tapshiriq.count({ where: { sahibkar_id: sahibkarId, status: { in: ["acig", "isleyir"] } } }).catch(() => 0),
        prisma.kassa_emeliyyatlari.aggregate({ _sum: { mebleg: true } }).catch(() => ({ _sum: { mebleg: 0 } })),
        prisma.$queryRaw<{ ad: string; cemi: number }[]>`
          SELECT m.ad, COALESCE(SUM(ss.miqdar * ss.satis_qiymet), 0)::float AS cemi
          FROM satis_sifaris_satirlari ss
          JOIN mehsullar m ON m.id = ss.mehsul_id
          JOIN satis_sifarisleri s ON s.id = ss.sifaris_id
          WHERE s.sahibkar_id = ${sahibkarId}::uuid AND s.tarix >= ${monthStart} AND s.status <> 'legv'
          GROUP BY m.ad ORDER BY cemi DESC LIMIT 5
        `.catch(() => []),
        prisma.$queryRaw<{ c: number }[]>`
          SELECT COUNT(*)::int AS c FROM mehsullar m
          LEFT JOIN stok st ON st.mehsul_id = m.id
          WHERE m.aktiv = true AND m.kritik_stok IS NOT NULL AND COALESCE(st.miqdar, 0) <= m.kritik_stok
        `.catch(() => [{ c: 0 }]),
        prisma.$queryRaw<{ c: number; cemi: number }[]>`
          SELECT COUNT(*)::int AS c, COALESCE(SUM(borc), 0)::float AS cemi
          FROM kontragentler WHERE borc > 0
        `.catch(() => [{ c: 0, cemi: 0 }]),
        prisma.sahibkar_partiya.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart } },
          _sum: { cemi_real_maya_azn: true }, _count: { _all: true },
        }).catch(() => null),
        prisma.istifadeciler.aggregate({ where: { aktiv: true }, _sum: { aylik_maas: true }, _count: { _all: true } }).catch(() => null),
      ]);

      const today = Number(todaySales._sum.son_mebleg ?? 0);
      const month = Number(monthSales._sum.son_mebleg ?? 0);
      const prevMonth = Number(prevMonthSales._sum.son_mebleg ?? 0);
      const monthDelta = prevMonth > 0 ? ((month - prevMonth) / prevMonth) * 100 : 0;
      const cash = Number(cashBalance._sum.mebleg ?? 0);
      const partiyaCemiAzn = Number(partiyaCemi?._sum.cemi_real_maya_azn ?? 0);
      const aylikMaas = Number(opexAylik?._sum.aylik_maas ?? 0);
      const isciSay = opexAylik?._count._all ?? 0;

      lines.push(
        `Bu günkü satış: ${fmt(today)} ${valyuta} (${todaySales._count._all} sifariş)`,
        `Bu ayın satışı: ${fmt(month)} ${valyuta} (${monthSales._count._all} sifariş)`,
        prevMonth > 0
          ? `Keçən ayla müqayisədə: ${monthDelta >= 0 ? "+" : ""}${monthDelta.toFixed(1)}% (keçən ay ${fmt(prevMonth)} ${valyuta})`
          : `Keçən ay satış yox idi`,
        `Kassa qalığı: ${fmt(cash)} ${valyuta}`,
        ``,
        `Aktiv məhsul: ${fmt(productCount)} ədəd · Müştəri: ${fmt(customerCount)} kontragent`,
        `Aktiv işçi: ${isciSay} (aylıq əmək haqqı cəmi ${fmt(aylikMaas)} ${valyuta})`,
        `Bu ayın idxal partiyaları: ${partiyaCemi?._count._all ?? 0} partiya, real maya ${fmt(partiyaCemiAzn)} ${valyuta}`,
        `Sahibkar açıq tapşırıq: ${openTasks}`,
        `Kritik stok: ${(lowStock[0]?.c ?? 0)} məhsul səviyyə altında`,
        (debtors[0]?.c ?? 0) > 0
          ? `Borclu müştəri: ${debtors[0]!.c} nəfər, cəmi ${fmt(Number(debtors[0]!.cemi))} ${valyuta}`
          : `Borclu müştəri yoxdur`,
        ``,
      );
      if (topProducts.length > 0) {
        lines.push(`Bu ayın TOP 5 satılan məhsulu:`);
        topProducts.forEach((p, i) => lines.push(`  ${i + 1}. ${p.ad} — ${fmt(Number(p.cemi))} ${valyuta}`));
        lines.push(``);
      }
      lines.push(
        `İCAZƏ: Tam sahibkar görüşü — bütün gəlir/xərc/maya/borc/məxfi qeyd və əməkdaş datalarını müzakirə edə bilərsən.`,
      );
    } else {
      // ─── ƏMƏKDAŞ (və ya əməkdaş rejimindəki sahibkar) — şəxsi performans + ümumi modul
      const [me, mySalesM, mySalesPrev, mySalesToday, doneThisMonth, openTasksMine, products, lowStock] = await Promise.all([
        prisma.istifadeciler.findUnique({
          where: { id: istifadeciId },
          select: { ad_soyad: true, vezife: true, aylik_maas: true, son_giris: true, roles: { select: { ad: true } } },
        }).catch(() => null),
        prisma.satis_sifarisleri.aggregate({
          where: { yaradan_id: istifadeciId, tarix: { gte: monthStart }, status: { not: "legv" } },
          _sum: { son_mebleg: true }, _count: { _all: true },
        }).catch(() => ({ _sum: { son_mebleg: 0 }, _count: { _all: 0 } })),
        prisma.satis_sifarisleri.aggregate({
          where: { yaradan_id: istifadeciId, tarix: { gte: prevMonthStart, lte: prevMonthEnd }, status: { not: "legv" } },
          _sum: { son_mebleg: true }, _count: { _all: true },
        }).catch(() => ({ _sum: { son_mebleg: 0 }, _count: { _all: 0 } })),
        prisma.satis_sifarisleri.aggregate({
          where: { yaradan_id: istifadeciId, tarix: { gte: dayStart }, status: { not: "legv" } },
          _sum: { son_mebleg: true }, _count: { _all: true },
        }).catch(() => ({ _sum: { son_mebleg: 0 }, _count: { _all: 0 } })),
        prisma.tapshiriqlar.count({
          where: { mesul_id: istifadeciId, status: "tamamlandi", yenilendi: { gte: monthStart } },
        }).catch(() => 0),
        prisma.tapshiriqlar.count({
          where: { mesul_id: istifadeciId, status: { in: ["yeni", "icrada"] } },
        }).catch(() => 0),
        prisma.mehsullar.count({ where: { aktiv: true } }).catch(() => 0),
        prisma.$queryRaw<{ c: number }[]>`
          SELECT COUNT(*)::int AS c FROM mehsullar m
          LEFT JOIN stok st ON st.mehsul_id = m.id
          WHERE m.aktiv = true AND m.kritik_stok IS NOT NULL AND COALESCE(st.miqdar, 0) <= m.kritik_stok
        `.catch(() => [{ c: 0 }]),
      ]);
      const myMonth = Number(mySalesM._sum.son_mebleg ?? 0);
      const myPrev = Number(mySalesPrev._sum.son_mebleg ?? 0);
      const myToday = Number(mySalesToday._sum.son_mebleg ?? 0);
      const myMonthDelta = myPrev > 0 ? ((myMonth - myPrev) / myPrev) * 100 : 0;
      const maas = Number(me?.aylik_maas ?? 0);

      lines.push(
        `Sənin adın: ${me?.ad_soyad ?? "—"}${me?.vezife ? `, vəzifə: ${me.vezife}` : ""}${me?.roles?.ad ? ` (${me.roles.ad})` : ""}`,
        ``,
        `=== ŞƏXSİ PERFORMANS ===`,
        `Bu günkü satışın: ${fmt(myToday)} ${valyuta} (${mySalesToday._count._all} sifariş)`,
        `Bu ayın satışı: ${fmt(myMonth)} ${valyuta} (${mySalesM._count._all} sifariş)`,
        myPrev > 0
          ? `Keçən ayla müqayisədə: ${myMonthDelta >= 0 ? "+" : ""}${myMonthDelta.toFixed(1)}%`
          : `Keçən ay satış yox idi`,
        `Bu ay tamamladığın tapşırıq: ${doneThisMonth}`,
        `Açıq tapşırığın sayı: ${openTasksMine}`,
        maas > 0 ? `Aylıq əmək haqqın: ${fmt(maas)} ${valyuta}` : `Aylıq maaş təyin edilməyib`,
        ``,
        `=== ÜMUMI MODUL GÖSTƏRİCİLƏRİ ===`,
        `Aktiv məhsul kataloqu: ${fmt(products)} ədəd`,
        `Kritik stoka düşmüş məhsul: ${lowStock[0]?.c ?? 0}`,
        ``,
        `=== İCAZƏ QAYDALARI ===`,
        `Sən əməkdaş rejimindəsən. Cavablandıra bildiyin mövzular:`,
        `  ✓ Şəxsi satış performansın, hədəfləri, müqayisə`,
        `  ✓ Öz aylıq əmək haqqın və hesablama (əgər soruşulsa)`,
        `  ✓ Açıq və tamamlanmış tapşırıqlar (yalnız sənə təyin olunanlar)`,
        `  ✓ Anbar/məhsul katalogu — ümumi sayı, kritik stok, axtarış kömək`,
        `  ✓ Müştəri xidməti və satış texnikaları üzrə məsləhət`,
        `  ✓ Vəzifən üzrə inkişaf və karyera tövsiyələri`,
        `  ✓ Sistemin istifadəsi (POS, qaimə, sifariş vermə)`,
        ``,
        `Cavablandıra BİLMƏDİYİN sahibkar-yalnız mövzular:`,
        `  ✗ Şirkətin ümumi gəliri, mənfəəti, P&L`,
        `  ✗ Kassa qalığı və maliyyə vəziyyəti`,
        `  ✗ Başqa işçilərin maaşı və ya performansı`,
        `  ✗ Maya/marja analizi, idxal partiyaları`,
        `  ✗ Borclu müştərilər və debitor analizi`,
        `  ✗ Məxfi sahibkar qeydləri, gizli əlaqələr`,
        `  ✗ Filial müqayisəsi və ümumi şəbəkə göstəriciləri`,
        ``,
        `Sahibkar-yalnız sual gəlsə nəzakətlə bildir: "Bu məlumat yalnız sahibkar rejimində əlçatandır. Sahibkar bölməsindən AI-ya soruş."`,
      );
    }

    lines.push(``, `</biznes_konteksti>`);
    return lines.join("\n");
  });
}

/**
 * Daily AI insight feed — derives a short list of plain-language insights
 * from cached business metrics. Real Claude integration may layer on top.
 */
const fetchDailyInsightsCached = (sahibkarId: string) =>
  unstable_cache(
    async () => {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(dayStart.getTime() - 24 * 3600 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const [
        todaySales, yesterdaySales, monthSales, prevMonthSales,
        openTasks, negStock, noImage,
      ] = await Promise.all([
        prismaUnscoped.satis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: dayStart }, status: { not: "legv" } },
          _sum: { son_mebleg: true },
          _count: { _all: true },
        }),
        prismaUnscoped.satis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: yesterdayStart, lt: dayStart }, status: { not: "legv" } },
          _sum: { son_mebleg: true },
          _count: { _all: true },
        }),
        prismaUnscoped.satis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, status: { not: "legv" } },
          _sum: { son_mebleg: true },
        }),
        prismaUnscoped.satis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: prevMonthStart, lte: prevMonthEnd }, status: { not: "legv" } },
          _sum: { son_mebleg: true },
        }),
        prismaUnscoped.sahibkar_tapshiriq.count({
          where: { sahibkar_id: sahibkarId, status: { in: ["acig", "isleyir"] } },
        }).catch(() => 0),
        prismaUnscoped.$queryRaw<{ c: number }[]>`
          SELECT COUNT(*)::int AS c FROM stok WHERE sahibkar_id = ${sahibkarId}::uuid AND miqdar < 0
        `.catch(() => [{ c: 0 }]),
        prismaUnscoped.mehsullar.count({
          where: { sahibkar_id: sahibkarId, OR: [{ sekil_url: null }, { sekil_url: "" }], aktiv: true },
        }).catch(() => 0),
      ]);

      return { todaySales, yesterdaySales, monthSales, prevMonthSales, openTasks, negStock, noImage };
    },
    ["ai-daily-insights", sahibkarId],
    { revalidate: 300, tags: [`ai:${sahibkarId}`, `dashboard:${sahibkarId}`] },
  );

export async function getDailyInsights() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const {
      todaySales, yesterdaySales, monthSales, prevMonthSales,
      openTasks, negStock, noImage,
    } = await fetchDailyInsightsCached(sahibkarId)();

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
