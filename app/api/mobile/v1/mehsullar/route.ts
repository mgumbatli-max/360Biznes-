import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getProducts } from "@/features/anbar/queries";

export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "mehsul.oxu", "anbar.oxu")) {
      return { error: "İcazə yoxdur", items: [], total: 0 };
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
