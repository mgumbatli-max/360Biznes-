import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getCampaigns } from "@/features/kampaniyalar/queries";

/** GET — kampaniya siyahısı. Web getCampaigns-i reuse edir. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "kampaniya"))) {
      return NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });
    }
    if (!mobilePerm(ctx, "kampaniya.oxu", "kampaniya.idare")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") ?? undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await getCampaigns(status && status !== "hamisi" ? { status } : undefined)) as any[];
    const items = rows.map((c) => ({
      id: c.id as string,
      ad: c.ad as string,
      tip: c.tip as string,
      status: c.status as string,
      bitme: c.bitme ? new Date(c.bitme).toISOString() : null,
      current_uses: Number(c.current_uses ?? 0),
      max_uses: c.max_uses ?? null,
      kupon_say: Number(c._count?.coupons ?? 0),
      reng: (c.reng as string) ?? null,
    }));
    return { items, total: items.length };
  });
}
