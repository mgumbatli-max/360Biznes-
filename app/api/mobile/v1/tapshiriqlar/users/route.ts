import { NextRequest, NextResponse } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getUsersForAssignment } from "@/features/tapshiriqlar/queries";

/** GET — tapşırıq təyin etmək üçün aktiv istifadəçilər (icraçı seçimi). */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "tapshiriq"))) {
      return NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });
    }
    const users = await getUsersForAssignment().catch(() => []);
    return { users };
  });
}
