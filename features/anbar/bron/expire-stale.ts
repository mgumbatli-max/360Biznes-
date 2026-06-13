import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * Müddəti keçmiş bron-ları "vaxti_bitdi" statusuna keçir.
 *
 * Sorğularda bitmə tarixinə görə zatən exclude olunur, amma bu funksiya
 * status-u explicit yeniləyir ki, bron siyahısında doğru görünsün.
 *
 * İstifadə:
 *   - Bron list endpoint-i çağırarkən bunu çağır (lazy expire)
 *   - Yaxud /api/cron/expire-bron daily run
 */

export async function expireStaleBronReservations(sahibkarId?: string): Promise<{
  updated: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await prisma.stok_bron.updateMany({
    where: {
      ...(sahibkarId ? { sahibkar_id: sahibkarId } : {}),
      status: "aktiv",
      bitme_tarixi: { lt: today },
    },
    data: { status: "vaxti_bitdi" },
  });

  return { updated: result.count };
}
