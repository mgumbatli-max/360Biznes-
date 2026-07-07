import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getProducts } from "@/features/anbar/queries";
import { ProductSchema, saveProductCore } from "@/features/anbar/save-product-core";

const MODUL_BAGLI = () =>
  NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });

export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "anbar"))) return MODUL_BAGLI();
    if (!mobilePerm(ctx, "mehsul.oxu", "anbar.oxu")) {
      // QA-mobil: icazə-yox → 403 (əvvəl plain-object 200 → mobil boş siyahı).
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const res = await getProducts(
      { search: sp.get("q") ?? undefined, recordStatus: "aktiv" },
      page,
      20,
    );
    return res;
  });
}

/** POST — yeni məhsul yarat. Token-əsaslı icazə + qiymət gözətçisi. */
export async function POST(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "anbar"))) return MODUL_BAGLI();
    if (!mobilePerm(ctx, "mehsul.yarat")) {
      return { error: "İcazə yoxdur" };
    }
    const body = await req.json().catch(() => ({}));
    const parsed = ProductSchema.safeParse(body);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return { error: first ?? "Forma yanlışdır" };
    }
    const canEditPrice = mobilePerm(ctx, "qiymet.duzelt");
    const res = await saveProductCore(parsed.data, { canEditPrice });
    return res;
  });
}
