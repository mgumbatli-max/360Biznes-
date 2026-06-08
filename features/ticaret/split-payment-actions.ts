"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireTicaretActionPerm, bustTicaretCache } from "./access-guard";

const SplitSchema = z.object({
  odenis_nov: z.enum(["negd", "kart", "kecirme", "nisye"]),
  mebleg: z.coerce.number().positive(),
});

const InputSchema = z.object({
  satis_id: z.string().uuid(),
  splits: z.array(SplitSchema).min(1).max(5),
});

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Apply a split payment to an existing sale. Creates a kassa_emeliyyatlari
 * row per non-nisye part, updates sale.odenilmis, and increments customer
 * debt for the nisye portion.
 *
 * Use case: a customer pays 100 AZN cash, 80 AZN by card, 20 AZN goes on
 * their tab — all in one transaction.
 */
export async function applySplitPayment(input: z.infer<typeof InputSchema>): Promise<ActionResult> {
  const permCheck = await requireTicaretActionPerm(["satis.odenis", "satis.idare", "kassa.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const data = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.$transaction(async (tx) => {
        const sale = await tx.satis_sifarisleri.findUnique({
          where: { id: data.satis_id },
          select: {
            id: true,
            son_mebleg: true,
            odenilmis: true,
            kassa_id: true,
            musteri_id: true,
            status: true,
          },
        });
        if (!sale) throw new Error("Satış tapılmadı");
        if (sale.status === "legv") throw new Error("Ləğv edilmiş satışa ödəniş olmaz");

        const son = Number(sale.son_mebleg ?? 0);
        const already = Number(sale.odenilmis ?? 0);
        const sumSplits = data.splits.reduce((s, p) => s + p.mebleg, 0);
        if (already + sumSplits > son + 0.001) {
          throw new Error(
            `Ödəniş cəmi yekundan çoxdur (${(already + sumSplits).toFixed(2)} > ${son.toFixed(2)})`
          );
        }

        let nonNisyeSum = 0;
        let nisyeSum = 0;
        for (const split of data.splits) {
          if (split.odenis_nov === "nisye") {
            nisyeSum += split.mebleg;
            continue;
          }
          nonNisyeSum += split.mebleg;
          if (sale.kassa_id) {
            await tx.kassa_emeliyyatlari.create({
              data: {
                sahibkar_id: sahibkarId,
                kassa_id: sale.kassa_id,
                emeliyyat_nov: "satis",
                odenis_nov: split.odenis_nov,
                mebleg: new Prisma.Decimal(split.mebleg),
                ref_nov: "satis_sifarisi_split",
                ref_id: sale.id,
                istifadeci_id: istifadeciId,
                qeyd: `Bölünmüş ödəniş: ${split.odenis_nov}`,
              },
            });
          }
        }

        await tx.satis_sifarisleri.update({
          where: { id: sale.id },
          data: {
            odenilmis: { increment: new Prisma.Decimal(nonNisyeSum + 0) }, // immediately-paid part
            yenilendi: new Date(),
          },
        });

        // Müştəri balansı — source-of-truth recalc
        if (sale.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(sale.musteri_id, tx);
        }
      });

      revalidatePath(`/ticaret/satislar/${data.satis_id}`);
      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret/kredit");
      bustTicaretCache();
      try {
        await audit("odenis", "satis_split", data.satis_id, {
          yeni_data: { splits: data.splits, count: data.splits.length },
          sebeb: "Bölünmüş ödəniş tətbiq edildi",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}
