"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { requireAnbarActionPerm } from "./access-guard";
import { safeAuditLog } from "@/lib/audit/safe-log";

/**
 * Sürətli brend (marka) yaratma — məhsul forması və ya digər seçimlərdən
 * birbaşa açılır. Yalnız ad tələb olunur.
 */
const QuickCreateBrandSchema = z.object({
  ad: z.string().min(2).max(120),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export type QuickCreateBrandInput = z.input<typeof QuickCreateBrandSchema>;
export type QuickCreateBrandResult =
  | { ok: true; brand: { id: number; ad: string } }
  | { ok: false; error: string };

export async function quickCreateBrand(
  input: QuickCreateBrandInput,
): Promise<QuickCreateBrandResult> {
  const permCheck = await requireAnbarActionPerm(["brend.yarat", "marka.yarat", "mehsul.yarat"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = QuickCreateBrandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const ad = d.ad.trim();
      const dup = await prisma.markalar.findFirst({
        where: { sahibkar_id: sahibkarId, ad: { equals: ad, mode: "insensitive" } },
        select: { id: true, ad: true, aktiv: true },
      });
      if (dup) {
        if (!dup.aktiv) {
          const reactivated = await prisma.markalar.update({
            where: { id: dup.id },
            data: { aktiv: true },
            select: { id: true, ad: true },
          });
          revalidateTag(`ref:${sahibkarId}:brands`, "max");
          return { ok: true, brand: reactivated };
        }
        return { ok: false, error: `Brend artıq mövcuddur: ${dup.ad}` };
      }

      const created = await prisma.markalar.create({
        data: {
          sahibkar_id: sahibkarId,
          ad,
          qeyd: d.qeyd?.trim() || null,
          aktiv: true,
        },
        select: { id: true, ad: true },
      });

      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "yarat",
        resurs_nov: "marka",
        resurs_id: String(created.id),
        yeni_data: { ad: created.ad, sursetli: true },
      });

      revalidatePath("/anbar/mehsullar");
      revalidatePath("/anbar/markalar");
      revalidateTag(`ref:${sahibkarId}:brands`, "max");

      return { ok: true, brand: created };
    } catch (e) {
      console.error("[quickCreateBrand]", e);
      const { safeUserMessage } = await import("@/lib/error/user-message");
      return { ok: false, error: safeUserMessage(e, "Brend yaradılmadı") };
    }
  });
}
