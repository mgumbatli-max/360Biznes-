"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { requireAyarActionPerm, bustAyarCache } from "./access-guard";
import { safeAuditLog } from "@/lib/audit/safe-log";

/**
 * Sürətli qiymət növü yaratma — POS, məhsul forması və müştəri formundan
 * inline açılır. Yalnız ad + opsional default marja.
 *
 * Kod ad-dan avtomatik generasiya edilir (latın hərfləri + _).
 */
const QuickCreatePriceTypeSchema = z.object({
  ad: z.string().min(2).max(100),
  default_marja: z.coerce.number().min(-100).max(100).optional().nullable(),
});

export type QuickCreatePriceTypeInput = z.input<typeof QuickCreatePriceTypeSchema>;
export type QuickCreatePriceTypeResult =
  | { ok: true; priceType: { id: number; kod: string; ad: string } }
  | { ok: false; error: string };

function slugify(ad: string): string {
  const map: Record<string, string> = {
    "ə": "e", "ı": "i", "ö": "o", "ü": "u", "ç": "c", "ş": "s", "ğ": "g",
    "Ə": "e", "I": "i", "Ö": "o", "Ü": "u", "Ç": "c", "Ş": "s", "Ğ": "g",
  };
  return ad
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "qn";
}

export async function quickCreatePriceType(
  input: QuickCreatePriceTypeInput,
): Promise<QuickCreatePriceTypeResult> {
  const permCheck = await requireAyarActionPerm(["ayar.qiymet", "ayar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = QuickCreatePriceTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const ad = d.ad.trim();
      const baseKod = slugify(ad);
      let kod = baseKod;
      let i = 2;
      while (true) {
        const exists = await prisma.qiymet_novleri.findFirst({
          where: { sahibkar_id: sahibkarId, kod },
          select: { id: true },
        });
        if (!exists) break;
        kod = `${baseKod}_${i++}`;
        if (i > 50) return { ok: false, error: "Unikal kod yaradıla bilmədi" };
      }

      const created = await prisma.qiymet_novleri.create({
        data: {
          sahibkar_id: sahibkarId,
          kod,
          ad,
          tip: "standart",
          default_marja: d.default_marja ?? null,
          formula_novu: "yox",
          formula_baza: "maya",
          formula_faiz: 0,
          aktiv: true,
        },
        select: { id: true, kod: true, ad: true },
      });

      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "yarat",
        resurs_nov: "qiymet_novu",
        resurs_id: String(created.id),
        yeni_data: { ad: created.ad, kod: created.kod, sursetli: true },
      });

      revalidatePath("/ayarlar/qiymet-tipi");
      revalidatePath("/pos");
      bustAyarCache();

      return { ok: true, priceType: created };
    } catch (e) {
      console.error("[quickCreatePriceType]", e);
      const { safeUserMessage } = await import("@/lib/error/user-message");
      return { ok: false, error: safeUserMessage(e, "Qiymət növü yaradılmadı") };
    }
  });
}
