import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getServisDetail } from "@/features/servis/queries";
import { serializeForJson } from "@/features/anbar/save-product-core";

/** GET — servis detalı. Web getServisDetail-i reuse edir. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "servis"))) {
      return NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });
    }
    if (!mobilePerm(ctx, "servis.oxu", "servis.idare")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const { id } = await params;
    const servis = await getServisDetail(id);
    if (!servis) return NextResponse.json({ error: "Servis tapılmadı" }, { status: 404 });
    return { servis: serializeForJson(servis as unknown as Record<string, unknown>) };
  });
}
