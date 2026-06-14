import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getDashboardKpis, getTopDebtors, getTopCreditors } from "@/features/maliyye/queries";

/** GET — maliyyə icmalı: KPI (balans, gəlir/xərc, mənfəət, debitor/kreditor) +
 *  ən böyük borclu/kreditor. Stealth-scale getDashboardKpis daxilində tətbiq olunur. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "maliyye.oxu", "maliyye.gor", "maliyye.idare")) {
      return { error: "İcazə yoxdur", kpis: null, debtors: [], creditors: [] };
    }
    const [kpis, debtors, creditors] = await Promise.all([
      getDashboardKpis().catch(() => null),
      getTopDebtors(5).catch(() => []),
      getTopCreditors(5).catch(() => []),
    ]);
    return { kpis, debtors, creditors };
  });
}
