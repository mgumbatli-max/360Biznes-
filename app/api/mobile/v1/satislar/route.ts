import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getSales, getSaleStats } from "@/features/ticaret/satis-queries";
import { createSaleCore } from "@/features/pos/sale-action";

const MODUL_BAGLI = () =>
  NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });

/** GET — satış siyahısı (axtarış + səhifələmə) + 1-ci səhifədə statistika. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "satis"))) return MODUL_BAGLI();
    if (!mobilePerm(ctx, "satis.oxu", "ticaret.oxu", "satis.idare")) {
      return { error: "İcazə yoxdur", items: [], total: 0 };
    }
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const [sales, stats] = await Promise.all([
      getSales(
        { search: sp.get("q") ?? undefined, recordStatus: "aktiv", sort: "tarix", dir: "desc" },
        page,
        20,
      ),
      page === 1 ? getSaleStats().catch(() => null) : Promise.resolve(null),
    ]);
    return { items: sales.items, total: sales.total, stats };
  });
}

/**
 * POST — POS satışı (isti satış). Web `createSale` ilə eyni `createSaleCore`
 * çəyirdəyini çağırır: idempotent (client_op_id), race-safe stok azalması,
 * kassa/finance/müştəri borc, POS çek nömrəsi. İcazə burada yoxlanılır.
 */
export async function POST(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "satis"))) return MODUL_BAGLI();
    if (!mobilePerm(ctx, "pos.satis", "satis.yarat", "satis.idare")) {
      return { ok: false, error: "Satış üçün icazə yoxdur" };
    }
    const body = await req.json().catch(() => ({}));
    // createSaleCore öz Zod validasiyasını edir; nəticəni olduğu kimi qaytarırıq.
    return createSaleCore(body);
  });
}
