"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

const AnbarSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  ad: z.string().min(2).max(100),
  unvan: z.string().max(500).optional().or(z.literal("")),
  filial_id: z.coerce.number().int().positive().optional().or(z.literal("")),
  mesul_id: z.string().uuid().optional().or(z.literal("")),
  aktiv: z.union([z.string(), z.boolean()]).optional(),
});

export async function saveWarehouse(input: FormData): Promise<ActionResult> {
  const parsed = AnbarSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const data = {
      ad: d.ad.trim(),
      unvan: d.unvan?.trim() || null,
      filial_id: typeof d.filial_id === "number" ? d.filial_id : null,
      mesul_id: typeof d.mesul_id === "string" && d.mesul_id ? d.mesul_id : null,
      aktiv: d.aktiv === "on" || d.aktiv === "true" || d.aktiv === true,
    };
    try {
      let row;
      if (d.id) {
        row = await prisma.anbarlar.update({ where: { id: d.id }, data });
      } else {
        row = await prisma.anbarlar.create({ data: { ...data, sahibkar_id: sahibkarId } });
      }
      revalidatePath("/ayarlar/anbar");
      revalidatePath("/anbar");
      return { ok: true, id: row.id };
    } catch (e) {
      console.error("[saveWarehouse]", e);
      return { ok: false, error: "Yaddasaxlama alınmadı" };
    }
  });
}
