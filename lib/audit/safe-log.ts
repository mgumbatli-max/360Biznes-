import "server-only";
import { prismaUnscoped } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * audit_log.create üçün təhlükəsiz wrapper.
 *
 * Köhnə pattern: hər çağırış try/catch içində console.warn — fail edən log
 * səssizcə yox olurdu. 22+ yerdə eyni anti-pattern vardı.
 *
 * Yeni pattern: əvvəlcə əsas audit_log.create cəhdi; uğursuz olarsa
 * audit_log_outbox cədvəlinə düşür → cron retry edə bilər (gələcəkdə).
 *
 * NB: prismaUnscoped istifadə olunur ki, audit log tenant filtrindən
 * asılı olmasın (sahibkar_id payload-da var).
 */
export async function safeAuditLog(
  data: Prisma.audit_logCreateInput | Prisma.audit_logUncheckedCreateInput,
): Promise<void> {
  try {
    await prismaUnscoped.audit_log.create({ data: data as Prisma.audit_logUncheckedCreateInput });
  } catch (e) {
    // İlk fail səbəbi outbox-a düşür — sonradan retry / debug üçün
    try {
      await prismaUnscoped.audit_log_outbox.create({
        data: {
          sahibkar_id: (data as { sahibkar_id?: string }).sahibkar_id ?? null,
          istifadeci_id: (data as { istifadeci_id?: string | null }).istifadeci_id ?? null,
          payload: data as Prisma.InputJsonValue,
          error_message: e instanceof Error ? e.message : String(e),
        },
      });
    } catch (outboxErr) {
      // Outbox-a yazma da uğursuzdur — son çarə kimi console-a yaz.
      console.error("[safeAuditLog] both audit_log AND outbox failed:", e, outboxErr);
    }
  }
}
