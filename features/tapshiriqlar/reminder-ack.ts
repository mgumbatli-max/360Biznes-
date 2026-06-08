"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";

type ActionResult = { ok: true; count?: number } | { ok: false; error: string };

/**
 * Bakı vaxtı (UTC+4, DST yoxdur) ilə "sabah saat 09:00"-u UTC Date kimi qaytarır.
 * Server hansı timezone-da işləyirsə işləsin, nəticə eyni olur.
 */
function tomorrow09Baku(now: Date = new Date()): Date {
  // İndi → Bakı vaxtı (UTC+4) → sabahın 09:00 Bakı = 05:00 UTC
  const bakuMs = now.getTime() + 4 * 3600 * 1000;
  const bakuDate = new Date(bakuMs);
  bakuDate.setUTCDate(bakuDate.getUTCDate() + 1);
  bakuDate.setUTCHours(9, 0, 0, 0);
  // Bakı timestamp → UTC timestamp (geri çıxar)
  return new Date(bakuDate.getTime() - 4 * 3600 * 1000);
}

function bustTaskCache(sahibkarId: string) {
  try {
    revalidateTag(`mywork:${sahibkarId}`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
  } catch { /* non-fatal */ }
}

/**
 * "Görüldü" — clears the reminder timestamp so the task no longer counts
 * toward the topbar badge. The task itself stays open.
 */
export async function dismissReminder(taskId: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
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
        select: { id: true, basliq: true },
      });
      if (!task) return { ok: false, error: "Tapşırıq tapılmadı və ya icazə yoxdur" };

      await prisma.tapshiriqlar.update({
        where: { id: taskId },
        data: { xatirlatma: null, xatirlatma_gonderildi: false, yenilendi: new Date() },
      });
      revalidatePath("/");
      revalidatePath(`/tapshiriqlar/${taskId}`);
      bustTaskCache(sahibkarId);
      await audit("xatirlatma_legv", "tapshiriq", taskId, {
        yeni_data: { basliq: task.basliq, sebeb: "manual_dismiss" },
      });
      return { ok: true };
    } catch (e) {
      console.error("[dismissReminder]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Xəta baş verdi: ${msg}` };
    }
  });
}

/**
 * Push the reminder N hours into the future. Task stays active, badge clears
 * until the new reminder time arrives.
 */
export async function snoozeReminder(taskId: string, mode: "1h" | "4h" | "sabah"): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const task = await prisma.tapshiriqlar.findFirst({
        where: {
          id: taskId,
          OR: [
            { mesul_id: istifadeciId },
            { tapshiriq_iscilier: { some: { istifadeci_id: istifadeciId } } },
          ],
        },
        select: { id: true, basliq: true, xatirlatma: true },
      });
      if (!task) return { ok: false, error: "Tapşırıq tapılmadı və ya icazə yoxdur" };

      let next: Date;
      if (mode === "1h") {
        next = new Date(Date.now() + 60 * 60 * 1000);
      } else if (mode === "4h") {
        next = new Date(Date.now() + 4 * 60 * 60 * 1000);
      } else {
        // Sabah 09:00 Bakı vaxtı (UTC+4)
        next = tomorrow09Baku();
      }

      await prisma.tapshiriqlar.update({
        where: { id: taskId },
        data: { xatirlatma: next, xatirlatma_gonderildi: false, yenilendi: new Date() },
      });
      revalidatePath("/");
      revalidatePath(`/tapshiriqlar/${taskId}`);
      bustTaskCache(sahibkarId);
      await audit("xatirlatma_tehir", "tapshiriq", taskId, {
        evvelki_data: { xatirlatma: task.xatirlatma?.toISOString() ?? null },
        yeni_data: { xatirlatma: next.toISOString(), mode, basliq: task.basliq },
      });
      return { ok: true };
    } catch (e) {
      console.error("[snoozeReminder]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Xəta baş verdi: ${msg}` };
    }
  });
}

/**
 * Bulk dismiss — mark every overdue reminder of the current user as seen.
 * Useful for the "Hamısını gizlət" button.
 */
export async function dismissAllReminders(): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
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
      bustTaskCache(sahibkarId);
      if (result.count > 0) {
        await audit("xatirlatma_legv_toplu", "tapshiriq", null, {
          yeni_data: { sayi: result.count },
        });
      }
      return { ok: true, count: result.count };
    } catch (e) {
      console.error("[dismissAllReminders]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Xəta baş verdi: ${msg}` };
    }
  });
}
