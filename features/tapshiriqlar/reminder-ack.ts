"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true; count?: number } | { ok: false; error: string };

/**
 * "Görüldü" — clears the reminder timestamp so the task no longer counts
 * toward the topbar badge. The task itself stays open.
 */
export async function dismissReminder(taskId: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      // Only the assignee/owner of the task can dismiss its reminder
      const task = await prisma.tapshiriqlar.findFirst({
        where: {
          id: taskId,
          OR: [
            { mesul_id: istifadeciId },
            { tapshiriq_iscilier: { some: { istifadeci_id: istifadeciId } } },
          ],
        },
        select: { id: true },
      });
      if (!task) return { ok: false, error: "Tapşırıq tapılmadı və ya icazə yoxdur" };

      await prisma.tapshiriqlar.update({
        where: { id: taskId },
        data: { xatirlatma: null, xatirlatma_gonderildi: false, yenilendi: new Date() },
      });
      revalidatePath("/");
      return { ok: true };
    } catch (e) {
      console.error("[dismissReminder]", e);
      return { ok: false, error: "Xəta baş verdi" };
    }
  });
}

/**
 * Push the reminder N hours into the future. Task stays active, badge clears
 * until the new reminder time arrives.
 */
export async function snoozeReminder(taskId: string, mode: "1h" | "4h" | "sabah"): Promise<ActionResult> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const task = await prisma.tapshiriqlar.findFirst({
        where: {
          id: taskId,
          OR: [
            { mesul_id: istifadeciId },
            { tapshiriq_iscilier: { some: { istifadeci_id: istifadeciId } } },
          ],
        },
        select: { id: true },
      });
      if (!task) return { ok: false, error: "Tapşırıq tapılmadı və ya icazə yoxdur" };

      let next: Date;
      if (mode === "1h") {
        next = new Date(Date.now() + 60 * 60 * 1000);
      } else if (mode === "4h") {
        next = new Date(Date.now() + 4 * 60 * 60 * 1000);
      } else {
        // sabah 09:00
        next = new Date();
        next.setDate(next.getDate() + 1);
        next.setHours(9, 0, 0, 0);
      }

      await prisma.tapshiriqlar.update({
        where: { id: taskId },
        data: { xatirlatma: next, xatirlatma_gonderildi: false, yenilendi: new Date() },
      });
      revalidatePath("/");
      return { ok: true };
    } catch (e) {
      console.error("[snoozeReminder]", e);
      return { ok: false, error: "Xəta baş verdi" };
    }
  });
}

/**
 * Bulk dismiss — mark every overdue reminder of the current user as seen.
 * Useful for the "Hamısını gizlət" button.
 */
export async function dismissAllReminders(): Promise<ActionResult> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const now = new Date();
      const result = await prisma.tapshiriqlar.updateMany({
        where: {
          OR: [
            { mesul_id: istifadeciId },
            { tapshiriq_iscilier: { some: { istifadeci_id: istifadeciId } } },
          ],
          status: { notIn: ["tamamlandi", "legv"] },
          xatirlatma: { lte: now, not: null },
        },
        data: { xatirlatma: null, xatirlatma_gonderildi: false, yenilendi: now },
      });
      revalidatePath("/");
      return { ok: true, count: result.count };
    } catch (e) {
      console.error("[dismissAllReminders]", e);
      return { ok: false, error: "Xəta baş verdi" };
    }
  });
}
