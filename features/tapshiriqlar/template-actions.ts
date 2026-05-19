"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getTemplate } from "./templates";

type Result = { ok: true; id: string } | { ok: false; error: string };

/** Spawn a task from a saved template. Includes optional checklist items. */
export async function createTaskFromTemplate(templateId: string): Promise<Result> {
  const tpl = getTemplate(templateId);
  if (!tpl) return { ok: false, error: "Şablon tapılmadı" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const deadline = tpl.defaults.deadline_offset_hours
        ? new Date(Date.now() + tpl.defaults.deadline_offset_hours * 3600 * 1000)
        : null;

      const task = await prisma.tapshiriqlar.create({
        data: {
          sahibkar_id: sahibkarId,
          yaradan_id: istifadeciId,
          mesul_id: istifadeciId,
          basliq: tpl.defaults.basliq,
          tesvir: tpl.defaults.tesvir,
          prioritet: tpl.prioritet,
          status: "yeni",
          deadline,
        },
        select: { id: true },
      });

      // Add checklist items
      if (tpl.checklist && tpl.checklist.length > 0) {
        await prisma.tapshiriq_checklist.createMany({
          data: tpl.checklist.map((label, idx) => ({
            tapshiriq_id: task.id,
            sahibkar_id: sahibkarId,
            metn: label,
            sira: idx,
            tamamlandi: false,
          })),
        });
      }

      revalidatePath("/tapshiriqlar");
      revalidatePath("/tapshiriqlar/sablonlar");
      return { ok: true, id: task.id };
    } catch (e) {
      console.error("[createTaskFromTemplate]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}
