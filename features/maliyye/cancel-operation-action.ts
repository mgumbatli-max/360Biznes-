"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireMaliyyeActionPerm, bustMaliyyeCache } from "./access-guard";

type ActionResult = { ok: true } | { ok: false; error: string };

const CancelSchema = z.object({
  operation_id: z.string().uuid(),
  reason: z.string().min(3, "Səbəb tələb olunur").max(1000),
});

/**
 * Maliyə əməliyyatını ləğv et (soft-delete pattern).
 *
 * - `status` → `legv`
 * - `deleted_at` → NOW
 * - `legv_sebeb` → mətn
 * - Bütün təsirlənmiş hesabların qaliqı source-of-truth ilə yenilənir
 *   (avtomatik geri qaytarılır, çünki legv əməliyyat source-of-truth-da
 *   istisnadır)
 * - Bağlı müştəri/təchizatçı balansı recalc olunur
 * - Bağlı satış/alış sənədində `odenilmis` azalır (allocation-dan)
 *
 * Audit-də tarixçə qalır.
 */
export async function cancelFinanceOperation(
  input: z.input<typeof CancelSchema>,
): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["fin_op.legv", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = CancelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Əməliyyatı oxu (idempotency yoxlaması)
        const op = await tx.finance_operations.findFirst({
          where: { id: d.operation_id, sahibkar_id: sahibkarId },
          select: {
            id: true,
            type_kod: true,
            status: true,
            hesab_id: true,
            hesab_id2: true,
            azn_meblegh: true,
            meblegh2: true,
            kontragent_id: true,
            isci_id: true,
            satis_id: true,
            alish_id: true,
            yön: true,
            deleted_at: true,
          },
        });
        if (!op) throw new Error("Əməliyyat tapılmadı");
        if (op.status === "legv" || op.deleted_at) {
          throw new Error("Bu əməliyyat artıq ləğv edilib");
        }

        // 1) Status legv + soft-delete sahələri
        await tx.finance_operations.update({
          where: { id: op.id },
          data: {
            status: "legv",
            legv_eden_id: istifadeciId,
            legv_de: new Date(),
            legv_sebeb: d.reason,
            deleted_at: new Date(),
            yenilendi: new Date(),
          },
        });

        // 2) Bağlı allocation-ları sil — satış/alış `odenilmis`-i geri açılsın
        const allocations = await tx.finance_payment_allocations.findMany({
          where: { payment_op_id: op.id },
          select: { id: true, satis_id: true, alish_id: true, mebleg: true },
        });
        const touchedSatis = new Set<string>();
        const touchedAlis = new Set<string>();
        for (const a of allocations) {
          await tx.finance_payment_allocations.delete({ where: { id: a.id } });
          if (a.satis_id) {
            await tx.satis_sifarisleri.updateMany({
              where: { id: a.satis_id, sahibkar_id: sahibkarId },
              data: { odenilmis: { decrement: Number(a.mebleg) } },
            });
            touchedSatis.add(a.satis_id);
          }
          if (a.alish_id) {
            await tx.alis_sifarisleri.updateMany({
              where: { id: a.alish_id, sahibkar_id: sahibkarId },
              data: { odenilmis: { decrement: Number(a.mebleg) } },
            });
            touchedAlis.add(a.alish_id);
          }
        }

        // 3) Hesab qaliqlarını source-of-truth-dan yenilə
        const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
        if (op.hesab_id) await recalculateAccountBalance(op.hesab_id, tx);
        if (op.hesab_id2) await recalculateAccountBalance(op.hesab_id2, tx);

        // 4) Kontragent balanslarını yenilə
        if (op.kontragent_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
          await recalculateCustomerBalance(op.kontragent_id, tx);
          await recalculateSupplierBalance(op.kontragent_id, tx);
        }

        // 5) Bağlı satışların müştəri balansını da yenilə (əgər allocation-dan dəyişdi)
        for (const satisId of touchedSatis) {
          const sale = await tx.satis_sifarisleri.findUnique({
            where: { id: satisId },
            select: { musteri_id: true },
          });
          if (sale?.musteri_id) {
            const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
            await recalculateCustomerBalance(sale.musteri_id, tx);
          }
        }
        for (const alisId of touchedAlis) {
          const purchase = await tx.alis_sifarisleri.findUnique({
            where: { id: alisId },
            select: { techiazatci_id: true },
          });
          if (purchase?.techiazatci_id) {
            const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
            await recalculateSupplierBalance(purchase.techiazatci_id, tx);
          }
        }

        return {
          touched_hesab: [op.hesab_id, op.hesab_id2].filter(Boolean).length,
          touched_satis: touchedSatis.size,
          touched_alis: touchedAlis.size,
        };
      });

      await audit("legv", "finance_operation", d.operation_id, {
        yeni_data: { sebeb: d.reason, ...result },
        sebeb: d.reason,
      });

      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/maliyye");
      revalidatePath("/maliyye/debitor");
      revalidatePath("/maliyye/kreditor");
      bustMaliyyeCache();
      return { ok: true };
    } catch (e) {
      console.error("[cancelFinanceOperation]", e);
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Ləğv alınmadı",
      };
    }
  });
}
