"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

const Schema = z.object({
  id: z.coerce.number().int().positive().optional(),
  kod: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/i, "Yalnız hərf/rəqəm/_"),
  ad: z.string().min(1).max(100),
  tip: z.string().max(20).optional().or(z.literal("")),
  default_marja: z.coerce.number().min(-100).max(100).optional().or(z.literal("")),
  min_marja: z.coerce.number().min(-100).max(100).optional().or(z.literal("")),
  aktiv: z.union([z.string(), z.boolean()]).optional(),
  tesvir: z.string().max(500).optional().or(z.literal("")),
  formula_novu: z.enum(["yox", "maya_uzeri", "satis_endirim", "fix"]).optional(),
  formula_baza: z.enum(["maya", "satis", "topdan"]).optional(),
  formula_faiz: z.coerce.number().optional().or(z.literal("")),
  yuvarla: z.coerce.number().optional().or(z.literal("")),
});

export async function savePriceType(input: FormData): Promise<ActionResult> {
  const parsed = Schema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const data = {
      kod: d.kod.trim().toLowerCase(),
      ad: d.ad.trim(),
      tip: d.tip?.trim() || "standart",
      default_marja: typeof d.default_marja === "number" ? d.default_marja : null,
      min_marja: typeof d.min_marja === "number" ? d.min_marja : null,
      aktiv: d.aktiv === "on" || d.aktiv === "true" || d.aktiv === true,
      tesvir: d.tesvir?.trim() || null,
      formula_novu: d.formula_novu ?? "yox",
      formula_baza: d.formula_baza ?? "maya",
      formula_faiz: typeof d.formula_faiz === "number" ? d.formula_faiz : 0,
      yuvarla: typeof d.yuvarla === "number" ? d.yuvarla : null,
      yenilendi: new Date(),
    };
    try {
      let row;
      if (d.id) {
        row = await prisma.qiymet_novleri.update({ where: { id: d.id }, data });
      } else {
        row = await prisma.qiymet_novleri.create({ data: { ...data, sahibkar_id: sahibkarId } });
      }
      revalidatePath("/ayarlar/qiymet-tipi");
      return { ok: true, id: row.id };
    } catch (e) {
      console.error("[savePriceType]", e);
      return { ok: false, error: "Yaddasaxlama alınmadı (bəlkə kod təkrarlanır)" };
    }
  });
}
