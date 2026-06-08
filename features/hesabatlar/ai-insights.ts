import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { chatCompletion, isMockMode } from "@/lib/ai/anthropic";
import { thisMonthRange, lastMonthRange } from "./shared";
import { getSalesKpi, getYoyComparison } from "./satis-queries";
import { getPlSummary } from "./maliyye-queries";
import { getDailyCashFlow30, getCashFlowSummary30 } from "./pul-queries";
import { checkAiReportQuota } from "./access-guard";

export type Insight = {
  kind: "info" | "success" | "warning" | "danger";
  title: string;
  body: string;
  severity?: number; // 1-10
  action_href?: string;
  action_label?: string;
};

/**
 * Build a structured business context dictionary, then ask Claude (or fall back to mock) for
 * 3-5 short insights. Returns deterministic stats + AI commentary.
 */
export async function buildAiInsights(): Promise<{ insights: Insight[]; ai_text: string; is_mock: boolean }> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const thisR = thisMonthRange();
    const lastR = lastMonthRange();

    const [thisKpi, lastKpi, pl, topCat, deadStock, oldestCustomer, yoy, dailyCash, arBuckets, customerConc, supplierConc, lowStockHighMargin] = await Promise.all([
      getSalesKpi({ range: thisR }),
      getSalesKpi({ range: lastR }),
      getPlSummary(thisR),
      prisma.$queryRaw<{ kateqoriya: string; gelir: number; margin: number | null }[]>`
        SELECT COALESCE(c.ad, '—') AS kateqoriya,
               SUM(sls.cemi)::float AS gelir,
               CASE WHEN SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0)) > 0
                    THEN ((SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0))) / SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0)) * 100)::float
                    ELSE NULL END AS margin
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          JOIN mehsullar m ON m.id = sls.mehsul_id
          LEFT JOIN kateqoriyalar c ON c.id = m.kateqoriya_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix BETWEEN ${thisR.from} AND ${thisR.to}
           AND ss.status != 'legv'
         GROUP BY c.ad
         ORDER BY gelir DESC
         LIMIT 5
      `.catch(() => [] as { kateqoriya: string; gelir: number; margin: number | null }[]),
      prisma.$queryRaw<{ c: bigint; val: number }[]>`
        SELECT COUNT(*)::bigint AS c, COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0)::float AS val
          FROM mehsullar m
          LEFT JOIN stok s ON s.mehsul_id = m.id
         WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
           AND COALESCE((SELECT SUM(s2.miqdar) FROM stok s2 WHERE s2.mehsul_id = m.id), 0) > 0
           AND NOT EXISTS (
             SELECT 1 FROM satis_sifaris_satirlari sls
               JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
              WHERE sls.mehsul_id = m.id AND ss.tarix >= CURRENT_DATE - INTERVAL '90 days' AND ss.status != 'legv'
           )
      `,
      prisma.$queryRaw<{ ad: string; gun: number }[]>`
        SELECT k.ad,
               (CURRENT_DATE - MAX(ss.tarix))::int AS gun
          FROM kontragentler k
          JOIN satis_sifarisleri ss ON ss.musteri_id = k.id
         WHERE k.sahibkar_id = ${sahibkarId}::uuid
           AND ss.status != 'legv'
           AND k.aktiv = TRUE
         GROUP BY k.id, k.ad
        HAVING MAX(ss.tarix) <= CURRENT_DATE - INTERVAL '60 days'
         ORDER BY gun DESC
         LIMIT 1
      `.catch(() => [] as { ad: string; gun: number }[]),
      getYoyComparison(thisR),
      getDailyCashFlow30(),
      prisma.$queryRaw<{ over90: number; over60: number }[]>`
        SELECT COALESCE(SUM(CASE WHEN gun > 90 THEN borc ELSE 0 END), 0)::float AS over90,
               COALESCE(SUM(CASE WHEN gun > 60 THEN borc ELSE 0 END), 0)::float AS over60
          FROM (
            SELECT k.borc::float AS borc,
                   (CURRENT_DATE - GREATEST(k.son_temas::date, k.yenilendi::date, k.yaradildi::date))::int AS gun
              FROM kontragentler k
             WHERE k.sahibkar_id = ${sahibkarId}::uuid
               AND COALESCE(k.borc, 0) > 0
          ) sub
      `.catch(() => [{ over90: 0, over60: 0 }]),
      // Customer concentration: top customer's share
      prisma.$queryRaw<{ ad: string; share: number }[]>`
        WITH s AS (
          SELECT k.ad, SUM(ss.son_mebleg)::float AS rev
            FROM satis_sifarisleri ss
            JOIN kontragentler k ON k.id = ss.musteri_id
           WHERE ss.sahibkar_id = ${sahibkarId}::uuid
             AND ss.tarix BETWEEN ${thisR.from} AND ${thisR.to}
             AND ss.status != 'legv'
           GROUP BY k.ad
        ),
        tot AS (SELECT NULLIF(SUM(rev), 0) AS total FROM s)
        SELECT s.ad, (s.rev / tot.total * 100)::float AS share
          FROM s, tot
         ORDER BY s.rev DESC
         LIMIT 1
      `.catch(() => [] as { ad: string; share: number }[]),
      // Supplier concentration
      prisma.$queryRaw<{ ad: string; share: number }[]>`
        WITH s AS (
          SELECT k.ad, SUM(asi.umumi_mebleg)::float AS amount
            FROM alis_sifarisleri asi
            JOIN kontragentler k ON k.id = asi.techiazatci_id
           WHERE asi.sahibkar_id = ${sahibkarId}::uuid
             AND asi.tarix BETWEEN ${thisR.from} AND ${thisR.to}
           GROUP BY k.ad
        ),
        tot AS (SELECT NULLIF(SUM(amount), 0) AS total FROM s)
        SELECT s.ad, (s.amount / tot.total * 100)::float AS share
          FROM s, tot
         ORDER BY s.amount DESC
         LIMIT 1
      `.catch(() => [] as { ad: string; share: number }[]),
      // Low stock + high margin = opportunity
      prisma.$queryRaw<{ ad: string; qaliq: number; margin_pct: number }[]>`
        SELECT m.ad,
               COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0)::float AS qaliq,
               CASE WHEN COALESCE(m.alish_qiymeti, 0) > 0
                    THEN ((m.satis_qiymeti - m.alish_qiymeti) / m.alish_qiymeti * 100)::float
                    ELSE 0 END AS margin_pct
          FROM mehsullar m
         WHERE m.sahibkar_id = ${sahibkarId}::uuid
           AND m.aktiv = TRUE
           AND COALESCE(m.alish_qiymeti, 0) > 0
           AND COALESCE(m.satis_qiymeti, 0) > 0
           AND ((m.satis_qiymeti - m.alish_qiymeti) / m.alish_qiymeti * 100) >= 30
         ORDER BY margin_pct DESC
         LIMIT 50
      `.catch(() => [] as { ad: string; qaliq: number; margin_pct: number }[]),
    ]);

    const insights: Insight[] = [];

    const change_pct = lastKpi.total_amount > 0
      ? ((thisKpi.total_amount - lastKpi.total_amount) / lastKpi.total_amount) * 100
      : thisKpi.total_amount > 0 ? 100 : 0;

    // 1. MoM sales trend
    insights.push({
      kind: change_pct >= 0 ? "success" : "warning",
      title: `Aylıq satış ${change_pct >= 0 ? "artıb" : "azalıb"}`,
      body: `Bu ay ${thisKpi.total_amount.toFixed(0)} ₼ satış oldu — keçən aya nisbətən ${change_pct.toFixed(1)}% ${change_pct >= 0 ? "artım" : "azalma"}.`,
      severity: Math.min(10, Math.max(1, Math.round(Math.abs(change_pct) / 5))),
      action_href: "/hesabatlar/satis",
      action_label: "Satış hesabatı",
    });

    // 2. YoY sales trend
    if (yoy.yoy_amount > 0) {
      insights.push({
        kind: yoy.change_pct >= 0 ? "success" : "warning",
        title: `İllik müqayisə: ${yoy.change_pct >= 0 ? "artım" : "azalma"}`,
        body: `Bu dövr keçən ilin eyni dövrü ilə müqayisədə ${yoy.change_pct.toFixed(1)}% ${yoy.change_pct >= 0 ? "yüksək" : "aşağı"} (${yoy.yoy_amount.toFixed(0)} ₼ → ${yoy.cur_amount.toFixed(0)} ₼).`,
        severity: Math.min(10, Math.max(2, Math.round(Math.abs(yoy.change_pct) / 5))),
        action_href: "/hesabatlar/satis",
        action_label: "Detallı bax",
      });
    }

    // 3. Net margin health
    if (pl.net_margin_pct < 5 && pl.revenue > 0) {
      insights.push({
        kind: "warning",
        title: "Net margin aşağıdır",
        body: `Net margin yalnız ${pl.net_margin_pct.toFixed(1)}%. Sağlam ERP-də 15%+ tövsiyə olunur. OPEX azaltmaq və ya qiymət strategiyasını yenidən baxmaq lazımdır.`,
        severity: 7,
        action_href: "/hesabatlar/maliyye",
        action_label: "P&L bax",
      });
    } else if (pl.net_margin_pct >= 15) {
      insights.push({
        kind: "success",
        title: "Sağlam net margin",
        body: `${pl.net_margin_pct.toFixed(1)}% net margin — biznes sağlam vəziyyətdədir.`,
        severity: 2,
      });
    }

    // 4. Category low margin
    if (topCat[0] && (topCat[0].margin ?? 0) < 10 && (topCat[0].margin ?? 0) >= 0) {
      insights.push({
        kind: "warning",
        title: `"${topCat[0].kateqoriya}" kateqoriyasında margin aşağıdır`,
        body: `Ən çox satılan "${topCat[0].kateqoriya}" kateqoriyasında margin yalnız ${(topCat[0].margin ?? 0).toFixed(1)}%. Topdan qiymət təkrar müzakirə edilməlidir.`,
        severity: 6,
        action_href: "/hesabatlar/marja",
        action_label: "Marja analizi",
      });
    }

    // 5. Dead stock
    const deadCount = Number(deadStock[0]?.c ?? 0);
    const deadVal = Number(deadStock[0]?.val ?? 0);
    if (deadCount > 0) {
      insights.push({
        kind: "warning",
        title: "Ölü stok aşkarlandı",
        body: `${deadCount} məhsul 90+ gündür satılmır (cəm dəyər ${deadVal.toFixed(0)} ₼). Endirim və ya promosyon tətbiq edin.`,
        severity: Math.min(8, 3 + Math.floor(deadCount / 5)),
        action_href: "/hesabatlar/mehsul",
        action_label: "Ölü stok",
      });
    }

    // 6. Dormant customer
    if (oldestCustomer[0]) {
      insights.push({
        kind: "info",
        title: `${oldestCustomer[0].ad} müştərisi qayıtmayıb`,
        body: `Bu müştəri son ${oldestCustomer[0].gun} gündür alış etməyib. Follow-up etmək lazımdır.`,
        severity: 4,
        action_href: "/musteriler",
        action_label: "Müştərilər",
      });
    }

    // 7. High return rate
    if (thisKpi.return_rate > 5) {
      insights.push({
        kind: "danger",
        title: "Qaytarma nisbəti yüksəkdir",
        body: `Qaytarma nisbəti ${thisKpi.return_rate.toFixed(1)}%. 5%-dən yüksəkdir — keyfiyyət problemi ola bilər.`,
        severity: 8,
        action_href: "/qaytarmalar",
        action_label: "Qaytarmalar",
      });
    }

    // 8. Cash runway risk
    const cf = await getCashFlowSummary30(dailyCash);
    if (cf.burn_per_day > 0 && cf.runway_days !== null && cf.runway_days < 60 && cf.closing_balance > 0) {
      insights.push({
        kind: cf.runway_days < 30 ? "danger" : "warning",
        title: "Pul axını runway qısalır",
        body: `Cari sürətlə ${cf.runway_days} gün runway qalıb. Mədaxili artırmaq və ya xərcləri azaltmaq lazımdır.`,
        severity: cf.runway_days < 30 ? 9 : 6,
        action_href: "/hesabatlar/pul",
        action_label: "Pul axını",
      });
    }

    // 9. AR aging risk
    const over90 = Number(arBuckets[0]?.over90 ?? 0);
    if (over90 > 0) {
      insights.push({
        kind: "danger",
        title: "90+ günlük borc",
        body: `${over90.toFixed(0)} ₼ borc 90+ gündür ödənilməyib. Hüquqi addım və ya yazılış riski yarana bilər.`,
        severity: 8,
        action_href: "/hesabatlar/musteri",
        action_label: "Borc analizi",
      });
    }

    // 10. Customer concentration risk
    if (customerConc[0] && Number(customerConc[0].share) > 35) {
      insights.push({
        kind: "warning",
        title: "Müştəri konsentrasiyası riski",
        body: `"${customerConc[0].ad}" müştərisi cəm satışın ${Number(customerConc[0].share).toFixed(1)}%-ni təşkil edir. Bu müştərini itirsəniz, böyük zərbə olar — diversifikasiya edin.`,
        severity: 7,
      });
    }

    // 11. Supplier concentration risk
    if (supplierConc[0] && Number(supplierConc[0].share) > 50) {
      insights.push({
        kind: "warning",
        title: "Təchizatçı asılılığı",
        body: `"${supplierConc[0].ad}" təchizatçısı cəm alışın ${Number(supplierConc[0].share).toFixed(1)}%-ni təşkil edir. Backup təchizatçı tapmaq tövsiyə olunur.`,
        severity: 6,
        action_href: "/hesabatlar/idxal",
        action_label: "İdxal hesabatı",
      });
    }

    // 12. Low stock high margin opportunity
    const lowAndProfitable = lowStockHighMargin.filter((r) => r.qaliq > 0 && r.qaliq < 5);
    if (lowAndProfitable.length > 0) {
      insights.push({
        kind: "info",
        title: `${lowAndProfitable.length} yüksək marjalı məhsul azalır`,
        body: `Yüksək marjalı (30%+) məhsullardan ${lowAndProfitable.length}-i stokda 5-dən azdır. Tezliklə sifariş edin ki, satışı qaçırmayasınız.`,
        severity: 5,
        action_href: "/anbar",
        action_label: "Stok bax",
      });
    }

    // Sort by severity descending
    insights.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));

    // Ask AI for free-form analytical text
    const context = [
      `Aylıq satış: bu ay ${thisKpi.total_amount.toFixed(0)} ₼ (${thisKpi.total_count} sifariş), keçən ay ${lastKpi.total_amount.toFixed(0)} ₼ (${lastKpi.total_count} sifariş).`,
      `Net mənfəət: ${pl.net_profit.toFixed(0)} ₼ (${pl.net_margin_pct.toFixed(1)}% margin).`,
      `Brüt margin: ${pl.gross_margin_pct.toFixed(1)}%.`,
      `Top 3 kateqoriya: ${topCat.slice(0, 3).map((c) => `${c.kateqoriya} (${c.gelir.toFixed(0)} ₼, margin ${(c.margin ?? 0).toFixed(1)}%)`).join("; ")}.`,
      `Ölü stok: ${deadCount} məhsul (${deadVal.toFixed(0)} ₼ dəyər).`,
      `Qaytarma %: ${thisKpi.return_rate.toFixed(1)}%.`,
      `Pul runway: ${cf.runway_days ?? "—"} gün, qalıq: ${cf.closing_balance.toFixed(0)} ₼.`,
      `90+ günlük borc: ${over90.toFixed(0)} ₼.`,
      customerConc[0] ? `Top müştəri payı: ${Number(customerConc[0].share).toFixed(1)}% (${customerConc[0].ad}).` : "",
      supplierConc[0] ? `Top təchizatçı payı: ${Number(supplierConc[0].share).toFixed(1)}% (${supplierConc[0].ad}).` : "",
    ].filter(Boolean).join("\n");

    // AI quota yoxlanması
    const quota = await checkAiReportQuota();
    if (!quota.ok) {
      return {
        insights,
        ai_text: `⚠ ${quota.error}\n\nQuota ayarlarını dəyişmək üçün sahibkar ilə əlaqə saxlayın.`,
        is_mock: true,
      };
    }

    const ai = await chatCompletion(
      [
        {
          role: "user",
          content: `Aşağıdakı biznes göstəricilərinə baxıb 3-4 qısa, konkret tövsiyə ver:\n\n${context}\n\nCavab Azərbaycan dilində, hər tövsiyə 1-2 cümlə olmalıdır. Konkret rəqəm və addımlardan istifadə et.`,
        },
      ],
      { max_tokens: 600 }
    );

    // Token + cost tracking — ai_sohbet_loq-a yaz
    try {
      const niyyet = ai.input_tokens != null && ai.output_tokens != null
        ? `i:${ai.input_tokens}/o:${ai.output_tokens}`
        : null;
      await prisma.ai_sohbet_loq.create({
        data: {
          sahibkar_id: sahibkarId,
          model: ai.model,
          prompt: context.slice(0, 2000),
          cavab: ai.text,
          kanal: "hesabat_ai",
          niyyet,
        },
      });
    } catch { /* noop */ }

    return { insights, ai_text: ai.text, is_mock: ai.is_mock || isMockMode() };
  });
}

/**
 * Cache-li wrapper — 30 dəq boyu eyni nəticə qaytarır.
 * Tag-lar: `hesabat:${sahibkarId}` (dashboard mutation-larında bust olunur).
 */
export async function buildAiInsightsCached(): Promise<{ insights: Insight[]; ai_text: string; is_mock: boolean; cached?: boolean }> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      () => buildAiInsights(),
      [`hesabat-ai-insights`, sahibkarId],
      { revalidate: 1800, tags: [`hesabat:${sahibkarId}`, `dashboard:${sahibkarId}`] },
    );
    const result = await cached();
    return { ...result, cached: true };
  });
}
