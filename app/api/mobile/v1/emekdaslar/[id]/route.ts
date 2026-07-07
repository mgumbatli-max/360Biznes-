import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getEmployeeDetail } from "@/features/iscilier/queries";
import { serializeForJson } from "@/features/anbar/save-product-core";

/** GET — əməkdaş detalı. Web getEmployeeDetail-i reuse edir. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "iscilier"))) {
      return NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });
    }
    if (!mobilePerm(ctx, "isci.view", "isci.idare")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const { id } = await params;
    const emp = await getEmployeeDetail(id);
    if (!emp) return NextResponse.json({ error: "Əməkdaş tapılmadı" }, { status: 404 });
    return { emekdas: serializeForJson(emp as unknown as Record<string, unknown>) };
  });
}
