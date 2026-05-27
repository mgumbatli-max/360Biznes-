"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeAuditLog } from "@/lib/audit/safe-log";

/**
 * Doğum günü xatırlatma — cron-əsaslı (manual da işlədilə bilər).
 *
 * Bu gün dogum_tarixi olan bütün kontragentlər üçün tapshiriqlar cədvəlinə
 * "Müştəri X-in doğum günüdür! Təbrik et" insert edir.
 * Mesul = kontragentler.menecer_id (yoxdursa yaradana qalır).
 *
 * Hər müştəri üçün bir gün ərzində ən çox bir tapşırıq yaranar
 * (tapshiriq_obyektleri qoşulması ilə yoxlanır).
 */

export type BirthdayResult = {
  ok: true;
  scanned: number;
  created: number;
  skipped: number;
};

export async function runBirthdayReminders(): Promise<BirthdayResult | { ok: false; error: string }> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Bu günün ayı və günü
      const now = new Date();
      const ay = now.getMonth() + 1;
      const gun = now.getDate();

      const rows = await prisma.$queryRaw<
        { id: string; ad: string; menecer_id: string | null }[]
      >`
        SELECT id, ad, menecer_id
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND aktiv = true
           AND dogum_tarixi IS NOT NULL
           AND EXTRACT(MONTH FROM dogum_tarixi) = ${ay}
           AND EXTRACT(DAY FROM dogum_tarixi) = ${gun}
      `.catch(() => []);

      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      let created = 0;
      let skipped = 0;
      for (const r of rows) {
        // Eyni müştəri üçün bu gün artıq tapşırıq yaranıbsa keç
        const existed = await prisma.tapshiriq_obyektleri.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            obyekt_nov: "musteri",
            obyekt_id: r.id,
            yaradildi: { gte: today, lt: tomorrow },
            tapshiriqlar: { tip: "dogum_gunu" },
          },
        });
        if (existed) {
          skipped++;
          continue;
        }

        const basliq = `Müştəri ${r.ad}-in doğum günüdür! Təbrik et`;
        const mesul = r.menecer_id ?? istifadeciId;

        try {
          await prisma.$transaction(async (tx) => {
            const t = await tx.tapshiriqlar.create({
              data: {
                sahibkar_id: sahibkarId,
                basliq,
                tesvir:
                  "Avtomatik yaradılmış: doğum günü təbriki üçün müştəri ilə əlaqə saxlayın.",
                prioritet: "normal",
                tip: "dogum_gunu",
                status: "yeni",
                deadline: tomorrow,
                yaradan_id: istifadeciId,
                mesul_id: mesul,
                gorunurluk: "umumi",
              },
            });
            await tx.tapshiriq_obyektleri.create({
              data: {
                tapshiriq_id: t.id,
                sahibkar_id: sahibkarId,
                obyekt_nov: "musteri",
                obyekt_id: r.id,
                obyekt_basliq: r.ad,
              },
            });
            await tx.tapshiriq_iscilier
              .create({
                data: {
                  tapshiriq_id: t.id,
                  istifadeci_id: mesul,
                  rol: "mesul",
                },
              })
              .catch(() => null);
          });
          created++;
        } catch (err) {
          console.warn("[runBirthdayReminders] task create failed", err);
          skipped++;
        }
      }

      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "dogum_xatirlatma",
        resurs_nov: "tapshiriq",
        yeni_data: {
          scanned: rows.length,
          created,
          skipped,
        } as unknown as object,
        status: "ugur",
      });

      revalidatePath("/elaqe/followup");
      revalidatePath("/tapshiriqlar");

      return { ok: true, scanned: rows.length, created, skipped };
    } catch (e) {
      console.error("[runBirthdayReminders]", e);
      return { ok: false, error: "Doğum günü xatırlatmaları yaranmadı" };
    }
  });
}
