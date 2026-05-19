"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

const TemplateSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  ad: z.string().min(2).max(100),
  hadisi: z.string().min(1).max(50),
  kanal: z.enum(["whatsapp", "sms", "email", "telegram", "instagram"]).default("whatsapp"),
  movzu: z.string().max(200).optional().or(z.literal("")),
  matn: z.string().min(2),
  aktiv: z.coerce.boolean().default(true),
});

export async function saveTemplate(input: FormData): Promise<ActionResult> {
  const parsed = TemplateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const vars = Array.from(d.matn.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)).map((m) => m[1]);
      const uniqueVars = [...new Set(vars)];
      const data = {
        ad: d.ad.trim(),
        hadisi: d.hadisi.trim(),
        kanal: d.kanal,
        movzu: d.movzu?.trim() || null,
        matn: d.matn.trim(),
        deyisenler: uniqueVars,
        aktiv: d.aktiv,
      };
      let id: number;
      if (d.id) {
        const updated = await prisma.mesaj_sablonlari.update({ where: { id: d.id }, data });
        id = updated.id;
      } else {
        const created = await prisma.mesaj_sablonlari.create({ data: { sahibkar_id: sahibkarId, ...data } });
        id = created.id;
      }
      revalidatePath("/crm/sablonlar");
      return { ok: true, id };
    } catch (e) {
      console.error("[saveTemplate]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deleteTemplate(id: number): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.mesaj_sablonlari.delete({ where: { id } });
      revalidatePath("/crm/sablonlar");
      return { ok: true };
    } catch (e) {
      console.error("[deleteTemplate]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}
