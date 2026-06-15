import { NextRequest, NextResponse } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { scanLookup } from "@/features/ticaret/qaytarma-tez-actions";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  return withMobile(req, async (mctx) => {
    if (!(await assertModuleAccess(mctx.sahibkarId, "anbar"))) {
      return NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });
    }
    return await scanLookup(decodeURIComponent(code));
  });
}
