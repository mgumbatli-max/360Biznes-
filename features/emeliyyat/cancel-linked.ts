"use server";

import type { LinkedOpType } from "./linked-operations";
import { cancelSale } from "@/features/ticaret/satis-actions";
import { cancelPurchase } from "@/features/ticaret/alis-actions";
import { cancelFinanceOperation } from "@/features/maliyye/cancel-operation-action";
import { cancelReturn } from "@/features/qaytarma/actions";

/**
 * Yerindəcə (in-place) ləğv marşrutu.
 *
 * Bağlı əməliyyatı tipinə görə MÖVCUD ləğv action-ına yönləndirir və hər birinin
 * cavabını ortaq `CancelLinkedResult` formasına normallaşdırır. İcazə yoxlaması
 * hər alət-action-ın öz içində (`requirePerm`/`requireTicaretActionPerm`/
 * `requireMaliyyeActionPerm`) baş verir — burada əlavə yoxlama yoxdur.
 *
 * transfer/servis üçün təmiz ləğv action-ı yoxdur → default mesaj (detala keç).
 */
export type CancelLinkedResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      blockers?: import("@/lib/blockers/types").Blocker[];
      hint?: string;
    };

export async function cancelLinkedOperation(
  op: { type: LinkedOpType; id: string },
  reason: string,
): Promise<CancelLinkedResult> {
  switch (op.type) {
    case "satis": {
      const r = await cancelSale(op.id, reason);
      return r.ok
        ? { ok: true }
        : { ok: false, error: r.error, blockers: r.blockers, hint: r.hint };
    }
    case "alis": {
      const r = await cancelPurchase(op.id, reason);
      return r.ok
        ? { ok: true }
        : { ok: false, error: r.error, blockers: r.blockers, hint: r.hint };
    }
    case "maliyye": {
      // cancelFinanceOperation input schema: { operation_id: uuid, reason }
      const r = await cancelFinanceOperation({ operation_id: op.id, reason });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    case "qaytarma": {
      const r = await cancelReturn(op.id, reason);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    default:
      // transfer / servis — yerindəcə təmiz ləğv action-ı yoxdur.
      return {
        ok: false,
        error: "Bu növü yerindəcə ləğv etmək mümkün deyil — detala keçin.",
      };
  }
}
