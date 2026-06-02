"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit, diffObjects } from "@/lib/audit/log";

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
        const before = await prisma.mesaj_sablonlari.findUnique({ where: { id: d.id }, select: { ad: true, hadisi: true, kanal: true, matn: true, aktiv: true } });
        const updated = await prisma.mesaj_sablonlari.update({ where: { id: d.id }, data });
        id = updated.id;
        const diff = diffObjects(before as Record<string, unknown> | null, data as unknown as Record<string, unknown>);
        if (diff) await audit("yenile", "mesaj_sablon", id, { evvelki_data: diff.before, yeni_data: diff.after });
      } else {
        const created = await prisma.mesaj_sablonlari.create({ data: { sahibkar_id: sahibkarId, ...data } });
        id = created.id;
        await audit("yarat", "mesaj_sablon", id, { yeni_data: { ad: d.ad, hadisi: d.hadisi, kanal: d.kanal } });
      }
      revalidatePath("/crm/sablonlar");
      revalidatePath("/ayarlar/mesaj-sablon");
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
      const before = await prisma.mesaj_sablonlari.findUnique({ where: { id }, select: { ad: true, hadisi: true, kanal: true } });
      await prisma.mesaj_sablonlari.delete({ where: { id } });
      await audit("sil", "mesaj_sablon", id, { evvelki_data: before as Record<string, unknown> | null, sebeb: "Şablon silindi" });
      revalidatePath("/crm/sablonlar");
      revalidatePath("/ayarlar/mesaj-sablon");
      return { ok: true };
    } catch (e) {
      console.error("[deleteTemplate]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}
