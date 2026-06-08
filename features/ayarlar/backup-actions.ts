"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireAyarActionPerm, bustAyarCache } from "./access-guard";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Backup-dan bərpa əməliyyatı — backup_berpa_log-a tələb yazır.
 * Faktiki məlumat bərpası background worker tərəfindən icra edilir.
 *
 * KRİTİK: sahibkar/admin yalnız ediyə bilər. Bütün hadisə audit-ə yazılır.
 */
export async function restoreBackup(id: string): Promise<ActionResult> {
  const permCheck = await requireAyarActionPerm("ayar.backup");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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
      bustAyarCache();
      // 🔥 KRİTİK AUDIT — restore = data overwrite riski
      await audit("berpa_tələb", "backup", id, {
        yeni_data: {
          backup_id: id,
          backup_ad: b.fayl_ad,
          tarix: new Date().toISOString(),
        },
        sebeb: `Backup-dan bərpa tələb olundu: ${b.fayl_ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[restoreBackup]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Bərpa tələbi yazılmadı: ${msg}` };
    }
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ
// ============================================================

/**
 * 1) Backup yaratma tələbi.
 */
export async function requestBackup(): Promise<ActionResult> {
  const permCheck = await requireAyarActionPerm("ayar.backup");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const stamp = new Date();
      const fayl_ad = `backup-${stamp.toISOString().slice(0, 19).replace(/[T:]/g, "-")}.sql`;
      const fayl_yolu = `/backups/${sahibkarId}/${fayl_ad}`;
      const created = await prisma.backups.create({
        data: {
          sahibkar_id: sahibkarId,
          fayl_ad,
          fayl_yolu,
          status: "gozleyir",
          nov: "manual",
          yaradan_id: istifadeciId,
        },
      });
      revalidatePath("/ayarlar/backup");
      bustAyarCache();
      await audit("yarat_tələb", "backup", created.id, {
        yeni_data: { fayl_ad, tarix: stamp.toISOString() },
        sebeb: `Yeni backup tələb olundu: ${fayl_ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[requestBackup]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Tələb yazılmadı: ${msg}` };
    }
  });
}
