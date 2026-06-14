import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getSales, getSaleStats } from "@/features/ticaret/satis-queries";

/** GET — satış siyahısı (axtarış + səhifələmə) + 1-ci səhifədə statistika. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
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
