import { NextRequest, NextResponse } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getServisRequests } from "@/features/servis/queries";

const MODUL_BAGLI = () =>
  NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });

/** GET — servis qeydləri siyahısı (status filtri + axtarış). Web getServisRequests-i reuse edir. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "servis"))) return MODUL_BAGLI();
    if (!mobilePerm(ctx, "servis.oxu", "servis.idare")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") ?? undefined;
    const q = (sp.get("q") ?? "").trim().toLowerCase();

    const rows = await getServisRequests({});
    let items = rows.map((r) => ({
      id: r.id,
      nomre: r.nomre,
      musteri_ad: r.musteri_ad,
      musteri_telefon: r.musteri_telefon,
      mehsul_ad: r.mehsul_ad,
      problem: r.problem_tesviri,
      status: r.status,
      prioritet: r.prioritet,
      servis_iscisi_ad: r.servis_iscisi_ad,
      texmini_tehvil: r.texmini_tehvil,
      temir_xerci: r.temir_xerci,
      zemanet_var: r.zemanet_var,
      yaradildi: r.yaradildi,
    }));
    if (status && status !== "hamisi") items = items.filter((x) => x.status === status);
    if (q) {
      items = items.filter((x) =>
        [x.nomre, x.musteri_ad, x.mehsul_ad, x.musteri_telefon].some((v) => (v ?? "").toLowerCase().includes(q)),
      );
    }
    return { items, total: items.length };
  });
}
