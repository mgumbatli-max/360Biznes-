import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getSaleStats } from "@/features/ticaret/satis-queries";
import { getProductProblemStats } from "@/features/anbar/problem-stats-queries";

/** GET — Ana ekran KPI icmalı: satış statistikası + anbar problemləri.
 *  İcazəyə görə hissə-hissə (sahibkar hamısını görür). Hər bölmə fail-safe. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const canSales = mobilePerm(ctx, "satis.oxu", "ticaret.oxu", "satis.idare");
    const canAnbar = mobilePerm(ctx, "mehsul.oxu", "anbar.oxu", "anbar.idare");

    const [sales, products] = await Promise.all([
      canSales ? getSaleStats().catch(() => null) : Promise.resolve(null),
      canAnbar ? getProductProblemStats().catch(() => null) : Promise.resolve(null),
    ]);

    return { sales, products };
  });
}
