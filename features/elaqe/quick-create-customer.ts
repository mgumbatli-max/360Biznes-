"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { requireElaqeActionPerm } from "./access-guard";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { normalizePhone } from "@/lib/utils/normalize-phone";

/**
 * Sürətli müştəri yaratma — POS, yeni satış modal və QuickOp dialogundan
 * birbaşa açılır. Tam saveContact formundan fərqli olaraq yalnız əsas sahələr.
 *
 * Aktiv=true, nov="musteri" — dərhal satış üçün hazır.
 */
const QuickCreateCustomerSchema = z.object({
  ad: z.string().min(2).max(200),
  telefon: z.string().max(30).optional().or(z.literal("")),
  email: z.string().max(150).optional().or(z.literal("")),
  voen: z.string().max(20).optional().or(z.literal("")),
  borc_limiti: z.coerce.number().min(0).optional().nullable(),
  qiymet_tipi: z.enum(["adi", "perakende", "topdan", "partnyor", "vip"]).optional(),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
});

export type QuickCreateCustomerInput = z.input<typeof QuickCreateCustomerSchema>;
export type QuickCreateCustomerResult =
  | { ok: true; customer: { id: string; ad: string; telefon: string | null; borc: number } }
  | { ok: false; error: string };

export async function quickCreateCustomer(
  input: QuickCreateCustomerInput,
): Promise<QuickCreateCustomerResult> {
  const permCheck = await requireElaqeActionPerm("musteri.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = QuickCreateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const tel = d.telefon ? normalizePhone(d.telefon) : null;

      // Telefon və ad birlikdə dublikat yoxlaması
      if (tel) {
        const dup = await prisma.kontragentler.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            telefon: tel,
            nov: { in: ["musteri", "her_ikisi"] },
          },
          select: { id: true, ad: true },
        });
        if (dup) {
          return { ok: false, error: `Bu telefon artıq "${dup.ad}" üçün qeydiyyatdadır` };
        }
      }

      const created = await prisma.kontragentler.create({
        data: {
          sahibkar_id: sahibkarId,
          nov: "musteri",
          ad: d.ad.trim(),
          telefon: tel,
          email: d.email?.trim() || null,
          voen: d.voen?.trim() || null,
          borc_limiti: d.borc_limiti && d.borc_limiti > 0 ? d.borc_limiti : null,
          qiymet_tipi: d.qiymet_tipi ?? "adi",
          qeyd: d.qeyd?.trim() || null,
          aktiv: true,
          alacaq: 0,
          borc: 0,
          avans: 0,
        },
        select: { id: true, ad: true, telefon: true },
      });

      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "yarat",
        resurs_nov: "musteri",
        resurs_id: created.id,
        yeni_data: { ad: created.ad, telefon: created.telefon, sursetli: true },
      });

      revalidatePath("/elaqe");
      revalidatePath("/elaqe/musteriler");
      revalidatePath("/pos");
      revalidatePath("/ticaret/satis-yeni");
      revalidateTag(`elaqe:${sahibkarId}`, "max");
      revalidateTag(`ref:${sahibkarId}:musteriler`, "max");

      return {
        ok: true,
        customer: { id: created.id, ad: created.ad, telefon: created.telefon, borc: 0 },
      };
    } catch (e) {
      console.error("[quickCreateCustomer]", e);
      const { safeUserMessage } = await import("@/lib/error/user-message");
      return { ok: false, error: safeUserMessage(e, "Müştəri yaradılmadı") };
    }
  });
}
