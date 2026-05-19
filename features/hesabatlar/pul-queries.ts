import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type CashFlowDay = { date: string; daxil: number; xaric: number };

export async function getDailyCashFlow30(): Promise<CashFlowDay[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);
    const rows = await prisma.$queryRaw<{ d: Date; daxil: number; xaric: number }[]>`
      SELECT date_trunc('day', tarix)::date AS d,
             SUM(CASE WHEN emeliyyat_nov IN ('satis','medaxil') THEN mebleg ELSE 0 END)::float AS daxil,
             SUM(CASE WHEN emeliyyat_nov IN ('qaytarma','mexaric') THEN mebleg ELSE 0 END)::float AS xaric
        FROM kassa_emeliyyatlari
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix >= ${since}
       GROUP BY 1
       ORDER BY 1 ASC
    `;
    return rows.map((r) => ({
      date: r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d),
      daxil: Number(r.daxil),
      xaric: Number(r.xaric),
    }));
  });
}

export type PaymentFlow = { odenis_nov: string; daxil: number; xaric: number };

export async function getCashFlowByPayment(): Promise<PaymentFlow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const rows = await prisma.$queryRaw<PaymentFlow[]>`
      SELECT odenis_nov,
             SUM(CASE WHEN emeliyyat_nov IN ('satis','medaxil') THEN mebleg ELSE 0 END)::float AS daxil,
             SUM(CASE WHEN emeliyyat_nov IN ('qaytarma','mexaric') THEN mebleg ELSE 0 END)::float AS xaric
        FROM kassa_emeliyyatlari
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix >= ${monthStart}
       GROUP BY odenis_nov
       ORDER BY daxil DESC
    `;
    return rows.map((r) => ({ ...r, daxil: Number(r.daxil), xaric: Number(r.xaric) }));
  });
}

export type AccountBalance = { id: string; ad: string; status: string | null; daxil: number; xaric: number };

export async function getAccountBalances(): Promise<AccountBalance[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<AccountBalance[]>`
      SELECT k.id::text, k.ad, k.status,
             COALESCE(SUM(CASE WHEN e.emeliyyat_nov IN ('satis','medaxil') THEN e.mebleg ELSE 0 END), 0)::float AS daxil,
             COALESCE(SUM(CASE WHEN e.emeliyyat_nov IN ('qaytarma','mexaric') THEN e.mebleg ELSE 0 END), 0)::float AS xaric
        FROM kassalar k
        LEFT JOIN kassa_emeliyyatlari e ON e.kassa_id = k.id
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
       GROUP BY k.id, k.ad, k.status
       ORDER BY daxil DESC
    `;
    return rows.map((r) => ({ ...r, daxil: Number(r.daxil), xaric: Number(r.xaric) }));
  });
}

export type CashFlowSummary = {
  total_in: number;
  total_out: number;
  net: number;
  opening_balance: number;
  closing_balance: number;
  burn_per_day: number;
  runway_days: number | null;
  run_rate_annual: number;
  min_day: { date: string; balance: number } | null;
  max_day: { date: string; balance: number } | null;
  change_pct: number;
};

export async function getCashFlowSummary30(daily: CashFlowDay[]): Promise<CashFlowSummary> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    // Opening balance = sum of all kassa operations strictly BEFORE `since`
    const openingRow = await prisma.$queryRaw<{ acilis: number }[]>`
      SELECT COALESCE(SUM(CASE
        WHEN emeliyyat_nov IN ('satis','medaxil') THEN mebleg
        WHEN emeliyyat_nov IN ('qaytarma','mexaric') THEN -mebleg
        ELSE 0 END), 0)::float AS acilis
        FROM kassa_emeliyyatlari
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND tarix < ${since}
    `.catch(() => [{ acilis: 0 }]);
    const opening = Number(openingRow[0]?.acilis ?? 0);

    let running = opening;
    let totalIn = 0;
    let totalOut = 0;
    let minDay: { date: string; balance: number } | null = null;
    let maxDay: { date: string; balance: number } | null = null;
    for (const d of daily) {
      totalIn += d.daxil;
      totalOut += d.xaric;
      running += d.daxil - d.xaric;
      if (!minDay || running < minDay.balance) minDay = { date: d.date, balance: running };
      if (!maxDay || running > maxDay.balance) maxDay = { date: d.date, balance: running };
    }
    const closing = running;
    const net = totalIn - totalOut;
    const days = Math.max(1, daily.length);
    const burnPerDay = totalOut / days;
    const runway = burnPerDay > 0 ? Math.floor(Math.max(0, closing) / burnPerDay) : null;
    const avgDailyNet = net / days;
    const runRateAnnual = avgDailyNet * 365;
    const changePct = opening !== 0 ? ((closing - opening) / Math.abs(opening)) * 100 : closing > 0 ? 100 : 0;

    return {
      total_in: totalIn,
      total_out: totalOut,
      net,
      opening_balance: opening,
      closing_balance: closing,
      burn_per_day: burnPerDay,
      runway_days: runway,
      run_rate_annual: runRateAnnual,
      min_day: minDay,
      max_day: maxDay,
      change_pct: changePct,
    };
  });
}

export type ExpenseCategory = { kateqoriya: string; mebleg: number; sayi: number };

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const rows = await prisma.$queryRaw<ExpenseCategory[]>`
      SELECT COALESCE(xk.ad, '—') AS kateqoriya,
             COALESCE(SUM(x.mebleg_azn), 0)::float AS mebleg,
             COUNT(*)::int AS sayi
        FROM "xerclər" x
        LEFT JOIN xerc_kateqoriyalari xk ON xk.id = x.kateqoriya_id
       WHERE x.sahibkar_id = ${sahibkarId}::uuid
         AND x.tarix >= ${monthStart}
       GROUP BY xk.ad
       ORDER BY mebleg DESC
    `.catch(() => [] as ExpenseCategory[]);
    return rows.map((r) => ({ ...r, mebleg: Number(r.mebleg), sayi: Number(r.sayi) }));
  });
}
