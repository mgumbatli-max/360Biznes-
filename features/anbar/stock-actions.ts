"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeStockDecrement } from "@/lib/db/stock-guards";

const StockAdjustSchema = z.object({
  mehsul_id: z.string().uuid(),
  anbar_id: z.coerce.number().int().positive(),
  nov: z.enum(["medaxil", "mexaric", "inventar"]),
  miqdar: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0).default(0),
  sebeb: z.string().min(2).max(500),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function adjustStock(input: z.input<typeof StockAdjustSchema>): Promise<ActionResult> {
  const parsed = StockAdjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    try {
      await prisma.$transaction(async (tx) => {
        // Find or create stok row
        const stok = await tx.stok.findFirst({
          where: { sahibkar_id: sahibkarId, mehsul_id: d.mehsul_id, anbar_id: d.anbar_id },
        });

        let newQty: number;
        if (d.nov === "medaxil") {
          newQty = (stok ? Number(stok.miqdar ?? 0) : 0) + d.miqdar;
        } else if (d.nov === "mexaric") {
          const current = stok ? Number(stok.miqdar ?? 0) : 0;
          if (current < d.miqdar) {
            throw new Error(`Stok kifayət deyil (mövcud: ${current}, çıxılacaq: ${d.miqdar})`);
          }
          newQty = current - d.miqdar;
        } else {
          // inventar = absolute value
          newQty = d.miqdar;
        }

        if (stok) {
          await tx.stok.update({
            where: { id: stok.id },
            data: { miqdar: newQty, ...(d.nov === "medaxil" && d.qiymet > 0 ? { son_qiymet: d.qiymet } : {}) },
          });
        } else {
          await tx.stok.create({
            data: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              anbar_id: d.anbar_id,
              miqdar: newQty,
              son_qiymet: d.qiymet,
            },
          });
        }

        await tx.anbar_hereketleri.create({
          data: {
            sahibkar_id: sahibkarId,
            anbar_id: d.anbar_id,
            mehsul_id: d.mehsul_id,
            nov: d.nov,
            miqdar: d.miqdar,
            qiymet: d.qiymet || null,
            ref_nov: "manual_adjust",
            edilen_id: istifadeciId,
            qeyd: d.sebeb,
          },
        });
      });

      revalidatePath("/anbar");
      revalidatePath("/anbar/mehsullar");
      revalidatePath("/anbar/hereketler");
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta";
      console.error("[adjustStock]", e);
      return { ok: false, error: msg };
    }
  });
}

const TransferSchema = z.object({
  mehsul_id: z.string().uuid(),
  kaynak_anbar_id: z.coerce.number().int().positive(),
  hedef_anbar_id: z.coerce.number().int().positive(),
  miqdar: z.coerce.number().positive(),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export async function transferStock(input: z.input<typeof TransferSchema>): Promise<ActionResult> {
  const parsed = TransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  if (d.kaynak_anbar_id === d.hedef_anbar_id) {
    return { ok: false, error: "Mənbə və hədəf anbarı eyni ola bilməz" };
  }

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    try {
      await prisma.$transaction(async (tx) => {
        // 1+2. Atomic check-and-decrement at source — race-safe
        const dec = await safeStockDecrement(tx, {
          mehsulId: d.mehsul_id,
          anbarId: d.kaynak_anbar_id,
          miqdar: d.miqdar,
        });
        if (!dec.ok) throw new Error(dec.error);
        // Need source row for son_qiymet reference (used in dest create below)
        const source = await tx.stok.findFirst({
          where: { sahibkar_id: sahibkarId, mehsul_id: d.mehsul_id, anbar_id: d.kaynak_anbar_id },
          select: { son_qiymet: true },
        });

        // 3. Increment dest (or create)
        const dest = await tx.stok.findFirst({
          where: { sahibkar_id: sahibkarId, mehsul_id: d.mehsul_id, anbar_id: d.hedef_anbar_id },
        });
        const refQiymet = source?.son_qiymet ?? null;
        if (dest) {
          await tx.stok.update({
            where: { id: dest.id },
            data: {
              miqdar: { increment: d.miqdar },
              ...(refQiymet ? { son_qiymet: refQiymet } : {}),
            },
          });
        } else {
          await tx.stok.create({
            data: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              anbar_id: d.hedef_anbar_id,
              miqdar: d.miqdar,
              son_qiymet: refQiymet,
            },
          });
        }

        // 4. Two movement records (source cıxış + hədəf giriş)
        await tx.anbar_hereketleri.createMany({
          data: [
            {
              sahibkar_id: sahibkarId,
              anbar_id: d.kaynak_anbar_id,
              mehsul_id: d.mehsul_id,
              nov: "transfer_cixis",
              miqdar: d.miqdar,
              qiymet: refQiymet ? Number(refQiymet) : null,
              ref_nov: "transfer",
              edilen_id: istifadeciId,
              qeyd: d.qeyd || null,
            },
            {
              sahibkar_id: sahibkarId,
              anbar_id: d.hedef_anbar_id,
              mehsul_id: d.mehsul_id,
              nov: "transfer_giris",
              miqdar: d.miqdar,
              qiymet: refQiymet ? Number(refQiymet) : null,
              ref_nov: "transfer",
              edilen_id: istifadeciId,
              qeyd: d.qeyd || null,
            },
          ],
        });
      });

      revalidatePath("/anbar");
      revalidatePath("/anbar/mehsullar");
      revalidatePath("/anbar/transfer");
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta";
      console.error("[transferStock]", e);
      return { ok: false, error: msg };
    }
  });
}
