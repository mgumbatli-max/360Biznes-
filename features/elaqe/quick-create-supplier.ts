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
 * Sürətli təchizatçı yaratma — alış qaiməsi modalı içindən və ya
 * "Yeni əməliyyat → Təchizatçı" menyusundan çağırılan minimal yaratma.
 *
 * Tam saveContact axınından fərqli olaraq, yalnız əsas sahələr.
 * Aktiv=true, nov="techizatci" olaraq dərhal istifadə üçün hazırdır.
 */

const QuickCreateSupplierSchema = z.object({
  ad: z.string().min(2).max(200),
  telefon: z.string().max(30).optional().or(z.literal("")),
  email: z.string().max(150).optional().or(z.literal("")),
  sirket_adi: z.string().max(200).optional().or(z.literal("")),
  voen: z.string().max(20).optional().or(z.literal("")),
  unvan: z.string().max(500).optional().or(z.literal("")),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
});

export type QuickCreateSupplierInput = z.input<typeof QuickCreateSupplierSchema>;
export type QuickCreateSupplierResult =
  | { ok: true; supplier: { id: string; ad: string; telefon: string | null } }
  | { ok: false; error: string };

export async function quickCreateSupplier(
  input: QuickCreateSupplierInput,
): Promise<QuickCreateSupplierResult> {
  const permCheck = await requireElaqeActionPerm("techizatci.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = QuickCreateSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const tel = d.telefon ? normalizePhone(d.telefon) : null;

      // Telefon üzrə dublikat yoxlaması
      if (tel) {
        const dup = await prisma.kontragentler.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            telefon: tel,
            nov: { in: ["techizatci", "her_ikisi"] },
          },
          select: { id: true, ad: true },
        });
        if (dup) {
          return { ok: false, error: `Bu telefon artıq mövcuddur: ${dup.ad}` };
        }
      }

      const created = await prisma.kontragentler.create({
        data: {
          sahibkar_id: sahibkarId,
          nov: "techizatci",
          ad: d.ad.trim(),
          telefon: tel,
          email: d.email?.trim() || null,
          sirket_adi: d.sirket_adi?.trim() || null,
          voen: d.voen?.trim() || null,
          unvan: d.unvan?.trim() || null,
          qeyd: d.qeyd?.trim() || null,
          aktiv: true,
        },
        select: { id: true, ad: true, telefon: true },
      });

      revalidatePath("/elaqe");
      try {
        revalidateTag(`elaqe:${sahibkarId}`, "max");
        revalidateTag(`ref:${sahibkarId}:musteriler`, "max");
      } catch { /* non-fatal */ }

      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "yarat_inline",
          resurs_nov: "kontragent",
          resurs_id: created.id,
          yeni_data: {
            nov: "techizatci",
            ad: created.ad,
            telefon: created.telefon,
            sirket_adi: d.sirket_adi ?? null,
            voen: d.voen ?? null,
          },
          sebeb: "Alış qaiməsi içindən və ya yeni əməliyyat menyusundan sürətli yaradıldı",
          status: "ugur",
        });
      } catch { /* non-fatal */ }

      return { ok: true, supplier: created };
    } catch (e) {
      console.error("[quickCreateSupplier]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Yaradılmadı" };
    }
  });
}
