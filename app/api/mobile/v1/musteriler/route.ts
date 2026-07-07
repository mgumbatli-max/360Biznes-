import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getContacts } from "@/features/elaqe/queries";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
import { normalizePhone } from "@/lib/utils/normalize-phone";

/** GET — müştəri siyahısı (axtarış + səhifələmə). Web getContacts-i reuse edir. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "musteri.oxu", "elaqe.oxu", "musteri.idare")) {
      // QA-mobil: icazə-yox → 403 (əvvəl plain-object 200 → mobil boş siyahı göstərirdi, error yox).
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const res = await getContacts(
      { nov: "musteri", search: sp.get("q") ?? undefined, recordStatus: "aktiv", status: "aktiv" },
      page,
      20,
    );
    return { items: res.items, total: res.total, stats: res.stats };
  });
}

const CreateSchema = z.object({
  ad: z.string().trim().min(2).max(200),
  telefon: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().max(150).optional().or(z.literal("")),
  voen: z.string().trim().max(20).optional().or(z.literal("")),
  borc_limiti: z.coerce.number().min(0).optional().nullable(),
  qiymet_tipi: z.enum(["adi", "perakende", "topdan", "partnyor", "vip"]).optional(),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
});

/** POST — yeni müştəri yarat (web quickCreateCustomer məntiqi, mobil token kontekstində). */
export async function POST(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "musteri.yarat", "musteri.idare")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
    }
    const d = parsed.data;
    const { sahibkarId } = requireTenant();
    const tel = d.telefon ? normalizePhone(d.telefon) : null;

    if (tel) {
      const dup = await prisma.kontragentler.findFirst({
        where: { telefon: tel, nov: { in: ["musteri", "her_ikisi"] } },
        select: { id: true, ad: true },
      });
      if (dup) return { error: `Bu telefon artıq "${dup.ad}" üçün qeydiyyatdadır` };
    }

    const created = await prisma.kontragentler.create({
      data: {
        sahibkar_id: sahibkarId,
        nov: "musteri",
        ad: d.ad,
        telefon: tel,
        email: d.email?.trim() || null,
        voen: d.voen?.trim() || null,
        borc_limiti: d.borc_limiti && d.borc_limiti > 0 ? d.borc_limiti : null,
        qiymet_tipi: d.qiymet_tipi ?? "adi",
        qeyd: d.qeyd?.trim() || null,
        aktiv: true,
        alacaq: 0,
        borc: 0,
        avans: 0,
      },
      select: { id: true, ad: true, telefon: true },
    });

    return { ok: true, customer: { id: created.id, ad: created.ad, telefon: created.telefon, borc: 0 } };
  });
}
