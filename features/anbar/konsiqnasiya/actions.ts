"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const CreateSchema = z.object({
  kontragent_id: z.string().uuid(),
  mehsul_id: z.string().uuid(),
  istiqamet: z.enum(["verilen", "alinan"]),
  sayi: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0).optional().nullable(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createKons(formData: FormData): Promise<ActionResult> {
  const parsed = CreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.konsiqnasiya.create({
        data: {
          sahibkar_id: sahibkarId,
          kontragent_id: d.kontragent_id,
          mehsul_id: d.mehsul_id,
          istiqamet: d.istiqamet,
          sayi: d.sayi,
          qiymet: d.qiymet ?? null,
          yaradan_id: istifadeciId,
          hesablashma_status: "aciq",
        },
      });
      revalidatePath("/anbar/konsiqnasiya");
      return { ok: true };
    } catch (e) {
      console.error("[createKons]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}
