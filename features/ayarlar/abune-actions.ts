"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { requireAyarActionPerm } from "./access-guard";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Plan dəyişikliyi — istifadəçi yeni plana keçir. Yeni `abuneler` qeydi yaradılır,
 * mövcud aktiv abunə dayandırılır. Ödəniş axını ayrı sistem üçündür.
 */
export async function changeSubscriptionPlan(planId: number, novu: "ayl_q" | "illik"): Promise<ActionResult> {
  // İcazə: abunə planını yalnız sahibkar/admin dəyişə bilər (əvvəl guard YOX idi —
  // istənilən autentifikasiya olunmuş istifadəçi tenant abunəsini dəyişə bilirdi).
  const permCheck = await requireAyarActionPerm("ayar.abune");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const plan = await prisma.abune_planlari.findUnique({ where: { id: planId } });
      if (!plan) return { ok: false, error: "Plan tapılmadı" };

      const now = new Date();
      const bitme = new Date(now);
      if (novu === "illik") bitme.setFullYear(bitme.getFullYear() + 1);
      else bitme.setMonth(bitme.getMonth() + 1);

      await prisma.$transaction([
        prisma.abuneler.updateMany({
          where: { sahibkar_id: sahibkarId, status: "aktiv" },
          data: { status: "dayandirildi" },
        }),
        prisma.abuneler.create({
          data: {
            sahibkar_id: sahibkarId,
            plan_id: planId,
            baslama: now,
            bitme,
            novu: novu === "illik" ? "illik" : "aylıq",
            status: "aktiv",
            meblegh: novu === "illik" ? plan.illik_qiymet ?? plan.ayl_q_qiymet : plan.ayl_q_qiymet,
          },
        }),
      ]);
      revalidatePath("/ayarlar/abune");
      return { ok: true };
    } catch (e) {
      console.error("[changeSubscriptionPlan]", e);
      return { ok: false, error: "Plan dəyişdirilmədi" };
    }
  });
}
