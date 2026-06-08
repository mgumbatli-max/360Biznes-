"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireAyarActionPerm, bustAyarCache } from "./access-guard";

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
  const permCheck = await requireAyarActionPerm("ayar.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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
      let before: Record<string, unknown> | null = null;
      if (d.id) {
        const ex = await prisma.xerc_kateqoriyalari.findUnique({
          where: { id: d.id },
          select: { ad: true, qrup: true, aktiv: true },
        });
        before = ex as Record<string, unknown> | null;
        row = await prisma.xerc_kateqoriyalari.update({ where: { id: d.id }, data });
      } else {
        row = await prisma.xerc_kateqoriyalari.create({ data: { ...data, sahibkar_id: sahibkarId } });
      }
      revalidatePath("/ayarlar/xerc-kateqoriya");
      bustAyarCache();
      await audit(d.id ? "yenile" : "yarat", "xerc_kateqoriya", row.id, {
        evvelki_data: before,
        yeni_data: data,
        sebeb: `Xərc kateqoriyası ${d.id ? "yeniləndi" : "yaradıldı"}: ${d.ad}`,
      });
      return { ok: true, id: row.id };
    } catch (e) {
      console.error("[saveExpenseCategory]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yaddasaxlama alınmadı: ${msg}` };
    }
  });
}
