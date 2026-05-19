"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Backup-dan bərpa əməliyyatı — backup_berpa_log-a tələb yazır.
 * Faktiki məlumat bərpası background worker tərəfindən icra edilir.
 */
export async function restoreBackup(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const b = await prisma.backups.findFirst({ where: { id, sahibkar_id: sahibkarId } });
      if (!b) return { ok: false, error: "Backup tapılmadı" };
      await prisma.backup_berpa_log.create({
        data: {
          sahibkar_id: sahibkarId,
          backup_id: id,
          istifadeci_id: istifadeciId,
          emeliyyat: "berpa",
          status: "gozleyir",
          detail: { backup_ad: b.fayl_ad, requested_at: new Date().toISOString() },
        },
      });
      revalidatePath("/ayarlar/backup");
      return { ok: true };
    } catch (e) {
      console.error("[restoreBackup]", e);
      return { ok: false, error: "Bərpa tələbi yazılmadı" };
    }
  });
}
