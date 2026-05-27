import "server-only";
import { prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Audit log outbox — sahibkar audit səhifəsində göstərmək üçün xülasə.
 * Pending = retry növbəsində; abandoned = MAX_RETRY-dən sonra durmuş
 * (manual müdaxilə tələb edir).
 */
export async function getAuditOutboxSummary() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [pending, abandoned, recentFails] = await Promise.all([
      prismaUnscoped.audit_log_outbox.count({
        where: { sahibkar_id: sahibkarId, status: "pending" },
      }),
      prismaUnscoped.audit_log_outbox.count({
        where: { sahibkar_id: sahibkarId, status: "abandoned" },
      }),
      prismaUnscoped.audit_log_outbox.findMany({
        where: { sahibkar_id: sahibkarId, status: { in: ["pending", "abandoned"] } },
        orderBy: { yenilendi: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          retry_count: true,
          error_message: true,
          yaradildi: true,
          next_retry_at: true,
        },
      }),
    ]);
    return { pending, abandoned, recentFails };
  });
}
