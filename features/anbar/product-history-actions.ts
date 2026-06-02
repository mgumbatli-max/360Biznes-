"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Məhsul tarixçəsindən tək qeyd siləcək action.
 * Yalnız sahibkar (rol 9), system admin (rol 1) və ya `audit_log.sil` icazəsi
 * olan istifadəçilər tərəfindən icazə verilir.
 */
export async function deleteProductHistoryEntry(
  productId: string,
  entryId: string,
): Promise<Result> {
  return withTenant(async () => {
    const ctx = requireTenant();
    const canDelete =
      ctx.rolAd === "admin" ||
      ctx.rolAd === "sahibkar" ||
      (ctx.icazeler?.includes("audit_log.sil") ?? false);
    if (!canDelete) return { ok: false, error: "İcazəniz yoxdur" };

    try {
      const idAsBigInt = BigInt(entryId);
      await prisma.audit_log.deleteMany({
        where: {
          id: idAsBigInt,
          sahibkar_id: ctx.sahibkarId,
          resurs_nov: "mehsul",
          resurs_id: productId,
        },
      });
      revalidatePath(`/anbar/mehsullar/${productId}`);
      return { ok: true };
    } catch (e) {
      console.error("[deleteProductHistoryEntry]", e);
      return { ok: false, error: "Silinə bilmədi" };
    }
  });
}
