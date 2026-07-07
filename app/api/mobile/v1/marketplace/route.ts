import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getMarketplaceAccounts, getMarketplaceStats } from "@/features/marketplace/queries";

/** GET — marketplace hesabları + sync statistikası. Web query-ləri reuse edir. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "marketplace"))) {
      return NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });
    }
    if (!mobilePerm(ctx, "marketplace.oxu", "marketplace.idare")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const [accounts, stats] = await Promise.all([getMarketplaceAccounts(), getMarketplaceStats()]);
    return { accounts, stats };
  });
}
