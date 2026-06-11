import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { DateRange } from "./shared";

export type PlSummary = {
  revenue: number;
  returns: number;
  cogs: number;
  gross_profit: number;
  opex: number;
  net_profit: number;
  gross_margin_pct: number;
  net_margin_pct: number;
  range: DateRange;
};

export async function getPlSummary(range: DateRange): Promise<PlSummary> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [salesAgg, cogsAgg, expensesAgg, returnsAgg] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: range.from, lte: range.to }, status: { not: "legv" }, qaralama: { not: true } },
        _sum: { son_mebleg: true },
      }),
      prisma.$queryRaw<{ cogs: number }[]>`
        SELECT COALESCE(SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0)), 0)::float AS cogs
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          JOIN mehsullar m ON m.id = sls.mehsul_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix BETWEEN ${range.from} AND ${range.to}
           AND ss.status != 'legv'
      `,
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(mebleg_azn), 0)::float AS total
          FROM "xerclər"
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix BETWEEN ${range.from} AND ${range.to}
      `.catch(() => [{ total: 0 }]),
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(umumi_mebleg), 0)::float AS total
          FROM qaytarma_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix BETWEEN ${range.from} AND ${range.to}
           -- QA-K30: təsdiqlənməmiş/ləğv edilmiş qaytarmalar P&L-ə düşməsin
           AND status NOT IN ('legv','tesdiqlenmemis')
      `.catch(() => [{ total: 0 }]),
    ]);

    const revenue = Number(salesAgg._sum.son_mebleg ?? 0);
    const returns = Number(returnsAgg[0]?.total ?? 0);
    const cogs = Number(cogsAgg[0]?.cogs ?? 0);
    const opex = Number(expensesAgg[0]?.total ?? 0);
    const net_revenue = revenue - returns;
    const gross = net_revenue - cogs;
    const net = gross - opex;

    return {
      revenue,
      returns,
      cogs,
      gross_profit: gross,
      opex,
      net_profit: net,
      gross_margin_pct: net_revenue > 0 ? (gross / net_revenue) * 100 : 0,
      net_margin_pct: net_revenue > 0 ? (net / net_revenue) * 100 : 0,
      range,
    };
  });
}

/** Year-over-year P&L comparison: this period vs same period 1 year ago. */
export async function getYoyPl(range: DateRange) {
  const yoyFrom = new Date(range.from);
  yoyFrom.setFullYear(yoyFrom.getFullYear() - 1);
  const yoyTo = new Date(range.to);
  yoyTo.setFullYear(yoyTo.getFullYear() - 1);
  const [cur, prev] = await Promise.all([getPlSummary(range), getPlSummary({ from: yoyFrom, to: yoyTo })]);
  const change_pct = (a: number, b: number) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : a !== 0 ? 100 : 0);
  return {
    cur,
    prev,
    revenue_change_pct: change_pct(cur.revenue, prev.revenue),
    net_change_pct: change_pct(cur.net_profit, prev.net_profit),
    gross_change_pct: change_pct(cur.gross_profit, prev.gross_profit),
  };
}

export type FixedVariableBreak = {
  fixed_total: number;
  variable_total: number;
  fixed_pct: number;
  variable_pct: number;
  categories: { ad: string; mebleg: number; tip: "sabit" | "deyisken" }[];
};

const FIXED_HINTS = ["kira", "icare", "icarə", "abun", "lisenz", "internet", "telefon", "maa", "elektrik", "kommunal", "qaz", "su", "amortiz"];

/** Heuristic split: name keywords or qrup field. */
export async function getFixedVariableBreak(range: DateRange): Promise<FixedVariableBreak> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ ad: string; mebleg: number; qrup: string | null }[]>`
      SELECT COALESCE(xk.ad, '—') AS ad,
             COALESCE(SUM(x.mebleg_azn), 0)::float AS mebleg,
             xk.qrup
        FROM "xerclər" x
        LEFT JOIN xerc_kateqoriyalari xk ON xk.id = x.kateqoriya_id
       WHERE x.sahibkar_id = ${sahibkarId}::uuid
         AND x.tarix BETWEEN ${range.from} AND ${range.to}
       GROUP BY xk.ad, xk.qrup
       ORDER BY mebleg DESC
    `.catch(() => [] as { ad: string; mebleg: number; qrup: string | null }[]);

    const categories = rows.map((r) => {
      const adLow = (r.ad ?? "").toLowerCase();
      const explicitFixed = (r.qrup ?? "").toLowerCase().includes("sabit") || (r.qrup ?? "").toLowerCase() === "fixed";
      const explicitVar = (r.qrup ?? "").toLowerCase().includes("dey") || (r.qrup ?? "").toLowerCase() === "variable";
      let tip: "sabit" | "deyisken";
      if (explicitFixed) tip = "sabit";
      else if (explicitVar) tip = "deyisken";
      else tip = FIXED_HINTS.some((h) => adLow.includes(h)) ? "sabit" : "deyisken";
      return { ad: r.ad, mebleg: Number(r.mebleg), tip };
    });
    const fixed_total = categories.filter((c) => c.tip === "sabit").reduce((s, c) => s + c.mebleg, 0);
    const variable_total = categories.filter((c) => c.tip === "deyisken").reduce((s, c) => s + c.mebleg, 0);
    const total = fixed_total + variable_total;
    return {
      fixed_total,
      variable_total,
      fixed_pct: total > 0 ? (fixed_total / total) * 100 : 0,
      variable_pct: total > 0 ? (variable_total / total) * 100 : 0,
      categories,
    };
  });
}

export type MonthlyPl = { ay: string; revenue: number; cogs: number; opex: number; gross: number; net: number };

export async function getMonthlyPl12(): Promise<MonthlyPl[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ ay: string; revenue: number; cogs: number; opex: number }[]>`
      WITH months AS (
        SELECT to_char(d, 'YYYY-MM') AS ay,
               date_trunc('month', d) AS m_start,
               date_trunc('month', d) + INTERVAL '1 month' - INTERVAL '1 day' AS m_end
          FROM generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
                               date_trunc('month', CURRENT_DATE), '1 month') AS d
      ),
      rev AS (
        SELECT to_char(tarix, 'YYYY-MM') AS ay, SUM(son_mebleg)::float AS revenue
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND status != 'legv' AND qaralama IS NOT TRUE
           AND tarix >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
         GROUP BY 1
      ),
      cogs AS (
        SELECT to_char(ss.tarix, 'YYYY-MM') AS ay,
               SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0))::float AS cogs
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
          JOIN mehsullar m ON m.id = sls.mehsul_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND ss.status != 'legv'
           AND ss.tarix >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
         GROUP BY 1
      ),
      opex AS (
        SELECT to_char(tarix, 'YYYY-MM') AS ay, SUM(mebleg_azn)::float AS opex
          FROM "xerclər"
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND tarix >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
         GROUP BY 1
      )
      SELECT m.ay,
             COALESCE(r.revenue, 0)::float AS revenue,
             COALESCE(c.cogs, 0)::float AS cogs,
             COALESCE(o.opex, 0)::float AS opex
        FROM months m
        LEFT JOIN rev r USING (ay)
        LEFT JOIN cogs c USING (ay)
        LEFT JOIN opex o USING (ay)
       ORDER BY m.ay ASC
    `.catch(() => [] as { ay: string; revenue: number; cogs: number; opex: number }[]);
    return rows.map((r) => {
      const revenue = Number(r.revenue);
      const cogs = Number(r.cogs);
      const opex = Number(r.opex);
      const gross = revenue - cogs;
      return { ay: r.ay, revenue, cogs, opex, gross, net: gross - opex };
    });
  });
}
