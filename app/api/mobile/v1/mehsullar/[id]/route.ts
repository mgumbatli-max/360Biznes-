import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getProductDetail } from "@/features/anbar/detail-queries";
import { ProductSchema, saveProductCore } from "@/features/anbar/save-product-core";

/** GET — məhsul detalı (oxu). */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return withMobile(req, async (mctx) => {
    if (!mobilePerm(mctx, "mehsul.oxu", "anbar.oxu")) {
      return { error: "İcazə yoxdur" };
    }
    const item = await getProductDetail(id);
    if (!item) return { error: "Məhsul tapılmadı" };
    return { item };
  });
}

/** PUT — məhsul redaktə. Token-əsaslı icazə + qiymət gözətçisi. */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return withMobile(req, async (mctx) => {
    if (!mobilePerm(mctx, "mehsul.duzelt")) {
      return { error: "İcazə yoxdur" };
    }
    const body = await req.json().catch(() => ({}));
    const parsed = ProductSchema.safeParse({ ...body, id });
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return { error: first ?? "Forma yanlışdır" };
    }
    const canEditPrice = mobilePerm(mctx, "qiymet.duzelt");
    const res = await saveProductCore(parsed.data, { canEditPrice });
    return res;
  });
}
