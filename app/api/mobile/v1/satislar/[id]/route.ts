import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getSaleDetail } from "@/features/ticaret/satis-queries";
import { serializeForJson } from "@/features/anbar/save-product-core";

/** GET — satış detalı (sətirlər + müştəri + ödəniş). Decimal/Date → number/ISO. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "satis.oxu", "ticaret.oxu", "satis.idare")) {
      return { error: "İcazə yoxdur" };
    }
    const { id } = await params;
    const sale = await getSaleDetail(id);
    if (!sale) return { error: "Satış tapılmadı" };
    return { sale: serializeForJson(sale as unknown as Record<string, unknown>) };
  });
}
