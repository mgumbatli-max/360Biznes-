"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTenant } from "@/lib/db/with-tenant";
import { audit } from "@/lib/audit/log";
import { deleteEntry, setEntry } from "./hr-store";
import type { SobePlan } from "./budce-queries";
import { requireHrActionPerm, bustHrCache } from "./access-guard";

type Result = { ok: true } | { ok: false; error: string };

const PlanSchema = z.object({
  sobe: z.string().min(1).max(100),
  planned_hire: z.coerce.number().int().min(0).max(1000),
  planned_replace: z.coerce.number().int().min(0).max(1000),
});

export async function saveSobePlan(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("hr.budce");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = PlanSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  return withTenant(async () => {
    const plan: SobePlan = parsed.data;
    await setEntry("hr_sobe_plan", plan.sobe, plan, `${plan.sobe} kvartal planı`);
    revalidatePath("/iscilier/budce");
    bustHrCache();
    await audit("yenile", "hr_budce", plan.sobe, {
      yeni_data: plan as unknown as Record<string, unknown>,
      sebeb: `Şöbə HR plan: ${plan.sobe}`,
    });
    return { ok: true };
  });
}

const DeleteSchema = z.object({ sobe: z.string().min(1) });

export async function deleteSobePlan(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("hr.budce");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = DeleteSchema.safeParse({ sobe: input.get("sobe") });
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  return withTenant(async () => {
    await deleteEntry("hr_sobe_plan", parsed.data.sobe);
    revalidatePath("/iscilier/budce");
    bustHrCache();
    await audit("sil", "hr_budce", parsed.data.sobe, { sebeb: `Şöbə HR plan silindi: ${parsed.data.sobe}` });
    return { ok: true };
  });
}
