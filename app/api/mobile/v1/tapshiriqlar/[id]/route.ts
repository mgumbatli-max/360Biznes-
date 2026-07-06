import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { assertModuleAccess } from "@/lib/mobile/module-access";
import { getTaskDetail } from "@/features/tapshiriqlar/detail-queries";
import { serializeForJson } from "@/features/anbar/save-product-core";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

const MODUL_BAGLI = () =>
  NextResponse.json({ error: "Bu modul şirkətiniz üçün aktiv deyil" }, { status: 403 });

/** GET — tapşırıq detalı. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "tapshiriq"))) return MODUL_BAGLI();
    const { id } = await params;
    const task = await getTaskDetail(id);
    if (!task) return { error: "Tapşırıq tapılmadı" };
    return { task: serializeForJson(task as unknown as Record<string, unknown>) };
  });
}

const PatchSchema = z.object({
  status: z.enum(["yeni", "icrada", "gozlemede", "tamamlandi", "legv"]),
});

/** PATCH — status dəyiş. Web changeTaskStatus-un mobil versiyası: giriş yoxlaması
 *  (privileged və ya yaradan/mesul/icraçı), sonra status yenilənir. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMobile(req, async (ctx) => {
    if (!(await assertModuleAccess(ctx.sahibkarId, "tapshiriq"))) return MODUL_BAGLI();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return { error: "Yanlış status" };
    const { sahibkarId, istifadeciId } = requireTenant();

    const task = await prisma.tapshiriqlar.findFirst({
      where: { id, sahibkar_id: sahibkarId },
      select: { id: true, yaradan_id: true, mesul_id: true, requires_approval: true, approved_by: true, tapshiriq_iscilier: { select: { istifadeci_id: true } } },
    });
    if (!task) return { error: "Tapşırıq tapılmadı" };

    const rolAd = (ctx.rolAd ?? "").toLowerCase();
    const privileged = rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin");
    const allowed =
      privileged ||
      task.yaradan_id === istifadeciId ||
      task.mesul_id === istifadeciId ||
      task.tapshiriq_iscilier.some((x) => x.istifadeci_id === istifadeciId) ||
      mobilePerm(ctx, "tapshiriq.idare");
    if (!allowed) return { error: "Bu tapşırığı dəyişmək üçün icazə yoxdur" };

    // QA-audit: mobil PATCH web changeTaskStatus-dakı requires_approval qapısını bypass edirdi →
    // icraçı öz təsdiq-tələb edən tapşırığını birbaşa 'tamamlandi' edə bilirdi. Eyni gate tətbiq olunur.
    if (parsed.data.status === "tamamlandi" && task.requires_approval && !task.approved_by) {
      const canApprove = privileged || task.yaradan_id === istifadeciId;
      if (!canApprove) {
        return { error: "Bu tapşırıq rəhbər təsdiqi tələb edir — birbaşa tamamlana bilməz. Status «Yoxlanılır»a keçirilməlidir." };
      }
    }

    await prisma.tapshiriqlar.update({
      where: { id },
      data: {
        status: parsed.data.status,
        tamamlandi_de: parsed.data.status === "tamamlandi" ? new Date() : null,
        ...(parsed.data.status === "tamamlandi" && task.requires_approval && !task.approved_by
          ? { approved_by: istifadeciId }
          : {}),
      },
    });
    return { ok: true };
  });
}
