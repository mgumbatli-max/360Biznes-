"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

/**
 * Mənbə anbar üçün məhsul stoklarını oxu — transfer modal-da məhsul seçildikdə
 * mövcud stok göstərilsin və artıq tələbə icazə verilməsin.
 *
 * Public server action — client komponentdən çağırılır.
 * Tenant scoping `withTenant` middleware-i tərəfindən təmin olunur.
 */
export async function getStockForAnbar(
  anbarId: number,
  mehsulIds: string[],
): Promise<Record<string, number>> {
  if (!Number.isFinite(anbarId) || anbarId <= 0 || mehsulIds.length === 0) return {};
  return withTenant(async () => {
    const rows = await prisma.stok.findMany({
      where: { anbar_id: anbarId, mehsul_id: { in: mehsulIds } },
      select: { mehsul_id: true, miqdar: true },
    });
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (r.mehsul_id) {
        map[r.mehsul_id] = Number(r.miqdar ?? 0);
      }
    }
    return map;
  });
}
