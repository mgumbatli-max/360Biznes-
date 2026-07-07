import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getAlerts } from "@/features/alerts/queries";

/** GET — nəzarət mərkəzi xəbərdarlıqları (açıq). Web getAlerts-i reuse edir. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "nezaret"))) {
      return NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });
    }
    if (!mobilePerm(ctx, "nezaret.oxu", "nezaret.dashboard", "nezaret.ayarlar")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const seviyye = sp.get("seviyye");
    const res = await getAlerts(
      {
        status: ["yeni", "baxilir"] as unknown as never[],
        ...(seviyye && seviyye !== "hamisi" ? { seviyye: [seviyye] as unknown as never[] } : {}),
        search: sp.get("q") ?? undefined,
      },
      page,
      25,
    );
    const items = res.items.map((a) => ({
      id: a.id,
      basliq: a.basliq,
      tesvir: a.tesvir,
      seviyye: a.seviyye,
      status: a.status,
      kateqoriya_ad: a.kateqoriya_ad,
      kateqoriya_emoji: a.kateqoriya_emoji,
      obyekt_basliq: a.obyekt_basliq,
      first_seen_at: a.first_seen_at,
    }));
    const todayStr = new Date().toISOString().slice(0, 10);
    const summary = {
      open: res.total,
      kritik: items.filter((a) => a.seviyye === "kritik").length,
      today: items.filter((a) => a.first_seen_at && new Date(a.first_seen_at).toISOString().slice(0, 10) === todayStr).length,
    };
    return { items, total: res.total, summary };
  });
}
