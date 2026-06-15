import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import {
  getProductDetail,
  getStockByWarehouse,
  getStockMovements,
  getRecentSalesForProduct,
  getProductSalesStats,
} from "@/features/anbar/detail-queries";
import { getServisHistoryForProduct } from "@/features/servis/queries";
import {
  ProductSchema,
  saveProductCore,
  serializeForJson,
} from "@/features/anbar/save-product-core";

const MODUL_BAGLI = () =>
  NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });

/**
 * GET — məhsul detalı (oxu).
 * Mobil detal ekranı üçün zəngin paket: baza məhsul + anbar üzrə stok +
 * son anbar hərəkətləri + son satışlar + satış statistikası + servis tarixçəsi.
 * `item`-dəki Decimal/Date sahələri `serializeForJson` ilə number/ISO-ya çevrilir
 * (siyahı endpoint-i ilə tip uyğunluğu üçün); qalan paketlər artıq JSON-safe-dir.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return withMobile(req, async (mctx) => {
    if (!(await assertModuleAccess(mctx.sahibkarId, "anbar"))) return MODUL_BAGLI();
    if (!mobilePerm(mctx, "mehsul.oxu", "anbar.oxu")) {
      return { error: "İcazə yoxdur" };
    }
    const item = await getProductDetail(id);
    if (!item) return { error: "Məhsul tapılmadı" };
    const [stok, hereketler, son_satislar, stats, servis] = await Promise.all([
      getStockByWarehouse(id),
      getStockMovements(id, 30),
      getRecentSalesForProduct(id, 20),
      getProductSalesStats(id),
      getServisHistoryForProduct(id),
    ]);
    return {
      item: serializeForJson(item as unknown as Record<string, unknown>),
      stok,
      hereketler,
      son_satislar,
      stats,
      servis,
    };
  });
}

/** PUT — məhsul redaktə. Token-əsaslı icazə + qiymət gözətçisi. */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return withMobile(req, async (mctx) => {
    if (!(await assertModuleAccess(mctx.sahibkarId, "anbar"))) return MODUL_BAGLI();
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
