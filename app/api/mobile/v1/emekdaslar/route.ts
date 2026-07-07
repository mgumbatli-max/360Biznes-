import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getEmployees } from "@/features/iscilier/queries";

const MODUL_BAGLI = () =>
  NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });

/** GET — əməkdaş siyahısı (axtarış). Web getEmployees-i reuse edir. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "iscilier"))) return MODUL_BAGLI();
    if (!mobilePerm(ctx, "isci.view", "isci.idare")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    const rows = await getEmployees({ recordStatus: "aktiv" });
    let items = rows.map((r) => ({
      id: r.id,
      ad_soyad: r.ad_soyad,
      vezife: r.vezife,
      rol_ad: r.rol_ad,
      telefon: r.telefon,
      email: r.email,
      status: r.status,
      aktiv: r.aktiv,
      profil_sekil: r.profil_sekil,
      default_filial_ad: r.default_filial_ad,
    }));
    if (q) {
      items = items.filter((x) =>
        [x.ad_soyad, x.vezife, x.telefon, x.email].some((v) => (v ?? "").toLowerCase().includes(q)),
      );
    }
    return { items, total: items.length };
  });
}
