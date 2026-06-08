"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { requireAnbarActionPerm } from "./access-guard";
import { safeAuditLog } from "@/lib/audit/safe-log";

/**
 * Sürətli anbar yaratma — satış/alış/transfer formalarından inline açılır.
 * Yalnız ad tələb olunur, ünvan opsionaldır.
 */
const QuickCreateWarehouseSchema = z.object({
  ad: z.string().min(2).max(100),
  unvan: z.string().max(500).optional().or(z.literal("")),
  filial_id: z.coerce.number().int().positive().optional().nullable(),
});

export type QuickCreateWarehouseInput = z.input<typeof QuickCreateWarehouseSchema>;
export type QuickCreateWarehouseResult =
  | { ok: true; warehouse: { id: number; ad: string } }
  | { ok: false; error: string };

export async function quickCreateWarehouse(
  input: QuickCreateWarehouseInput,
): Promise<QuickCreateWarehouseResult> {
  const permCheck = await requireAnbarActionPerm(["anbar.yarat", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = QuickCreateWarehouseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const ad = d.ad.trim();
      const dup = await prisma.anbarlar.findFirst({
        where: { sahibkar_id: sahibkarId, ad: { equals: ad, mode: "insensitive" }, aktiv: true },
        select: { id: true, ad: true },
      });
      if (dup) {
        return { ok: false, error: `Anbar artıq mövcuddur: ${dup.ad}` };
      }

      const created = await prisma.anbarlar.create({
        data: {
          sahibkar_id: sahibkarId,
          ad,
          unvan: d.unvan?.trim() || null,
          filial_id: d.filial_id ?? null,
          aktiv: true,
        },
        select: { id: true, ad: true },
      });

      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "yarat",
        resurs_nov: "anbar",
        resurs_id: String(created.id),
        yeni_data: { ad: created.ad, sursetli: true },
      });

      revalidatePath("/anbar");
      revalidatePath("/anbar/anbarlar");
      revalidatePath("/ticaret/satis-yeni");
      revalidatePath("/ticaret/alis-yeni");
      revalidateTag(`ref:${sahibkarId}:warehouses`, "max");

      return { ok: true, warehouse: created };
    } catch (e) {
      console.error("[quickCreateWarehouse]", e);
      const { safeUserMessage } = await import("@/lib/error/user-message");
      return { ok: false, error: safeUserMessage(e, "Anbar yaradılmadı") };
    }
  });
}
