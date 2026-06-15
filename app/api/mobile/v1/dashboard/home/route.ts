import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import {
  getCeoKpis,
  getMonthlyComparison,
  getTodayCashFlow,
  getMyPendingWork,
  getDailyInsight,
  getCriticalAlertsForDash,
  getLowStockItems,
  getTopProducts,
  getTopSellers,
  getTopCustomers,
  getTopPlatforms,
  getTopDebtors,
  getRecentSalesByDay,
  getSalesVsExpense30,
} from "@/features/dashboard/queries";

/**
 * GET — mobil Əsas ekranı (web /dashboard mobil/lite görünüşü ilə 1-1) üçün
 * VAHİD kompozit data. Web dashboard-un paralel Suspense axınını güzgüləyir:
 * bütün sorğular Promise.all ilə paralel, hər biri fail-soft (`.catch → null`)
 * — biri düşsə qalan bölmələr yenə render olunur.
 *
 * Permission-paritet: maliyyə-həssas (pul axını, borclular) `maliyye.oxu`,
 * stok `anbar.oxu` gate-i altındadır (mobilePerm sahibkar/admin-i keçirir).
 * Bağlı olanlar `null` qaytarır → app həmin bölməni render etmir.
 * Lite/Pro bölmə görünürlüyü CİHAZDA (app-config lite blokları) həll olunur.
 */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const canFin = mobilePerm(ctx, "maliyye.oxu");
    const canStok = mobilePerm(ctx, "anbar.oxu");
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

    const [
      ceo,
      monthly,
      cashflow,
      mywork,
      insight,
      alerts,
      lowStock,
      products,
      sellers,
      customers,
      platforms,
      debtors,
      sales30,
      salesVsExp30,
    ] = await Promise.all([
      safe(getCeoKpis()),
      safe(getMonthlyComparison()),
      canFin ? safe(getTodayCashFlow()) : Promise.resolve(null),
      safe(getMyPendingWork()),
      safe(getDailyInsight()),
      safe(getCriticalAlertsForDash(5)),
      canStok ? safe(getLowStockItems(8)) : Promise.resolve(null),
      safe(getTopProducts(5)),
      safe(getTopSellers(5)),
      safe(getTopCustomers(5)),
      safe(getTopPlatforms(5)),
      canFin ? safe(getTopDebtors(5)) : Promise.resolve(null),
      safe(getRecentSalesByDay(30)),
      safe(getSalesVsExpense30()),
    ]);

    return {
      ceo,
      monthly,
      cashflow,
      mywork,
      insight,
      alerts,
      lowStock,
      top: { products, sellers, customers, platforms },
      debtors,
      sales30,
      salesVsExp30,
    };
  });
}
