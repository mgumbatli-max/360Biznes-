"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

const Schema = z.object({
  id: z.coerce.number().int().positive().optional(),
  ad: z.string().min(1).max(100),
  qrup: z.string().max(50).optional().or(z.literal("")),
  ikon: z.string().max(50).optional().or(z.literal("")),
  reng: z.string().max(20).optional().or(z.literal("")),
  aktiv: z.union([z.string(), z.boolean()]).optional(),
});

export async function saveExpenseCategory(input: FormData): Promise<ActionResult> {
  const parsed = Schema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const data = {
      ad: d.ad.trim(),
      qrup: d.qrup?.trim() || null,
      ikon: d.ikon?.trim() || null,
      reng: d.reng?.trim() || "#64748b",
      aktiv: d.aktiv === "on" || d.aktiv === "true" || d.aktiv === true,
    };
    try {
      let row;
      if (d.id) {
        row = await prisma.xerc_kateqoriyalari.update({ where: { id: d.id }, data });
      } else {
        row = await prisma.xerc_kateqoriyalari.create({ data: { ...data, sahibkar_id: sahibkarId } });
      }
      revalidatePath("/ayarlar/xerc-kateqoriya");
      return { ok: true, id: row.id };
    } catch (e) {
      console.error("[saveExpenseCategory]", e);
      return { ok: false, error: "Yaddasaxlama alınmadı (ad təkrarlanır?)" };
    }
  });
}
