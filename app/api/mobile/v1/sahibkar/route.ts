import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getCostAnalysis } from "@/features/sahibkar/queries";

/** GET — sahibkar maya/mənfəət analizi (bu ay). Yalnız sahibkar/owner. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "sahibkar"))) {
      return NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });
    }
    // "sahibkar.view" heç bir rolun icazə kataloqunda yoxdur → mobilePerm yalnız owner/admin rol-bypass ilə true.
    if (!mobilePerm(ctx, "sahibkar.view")) {
      return NextResponse.json({ error: "Yalnız sahibkar üçün" }, { status: 403 });
    }
    const cost = await getCostAnalysis();
    return { cost };
  });
}
