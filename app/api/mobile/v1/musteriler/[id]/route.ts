import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getContactDetail } from "@/features/elaqe/queries";
import { getContactSalesHistory } from "@/features/elaqe/detail-queries";

/** GET — müştəri detalı (məlumat + borc + son satışlar). Decimal sahələr number-ə çevrilir. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "musteri.oxu", "elaqe.oxu", "musteri.idare")) {
      return { error: "İcazə yoxdur" };
    }
    const { id } = await params;
    const c = await getContactDetail(id);
    if (!c) return { error: "Müştəri tapılmadı" };

    const num = (v: unknown) => (v == null ? null : Number(v));
    const customer = {
      ...c,
      borc: Number(c.borc ?? 0),
      alacaq: Number(c.alacaq ?? 0),
      avans: Number(c.avans ?? 0),
      borc_limiti: num(c.borc_limiti),
    };

    // Son satışlar (qısa tarixçə) — boş olarsa keç
    const sales = await getContactSalesHistory(id, 20).catch(() => []);

    return { customer, sales };
  });
}
