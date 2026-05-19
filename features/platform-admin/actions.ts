"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prismaUnscoped } from "@/lib/db/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";

export async function setTenantStatus(id: string, status: "aktiv" | "dayandirildi"): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePlatformAdmin();
  try {
    await prismaUnscoped.sahibkarlar.update({ where: { id }, data: { status } });
    revalidatePath("/platform-admin/tenantlar");
    revalidatePath(`/platform-admin/tenantlar/${id}`);
    return { ok: true };
  } catch (e) {
    console.error("[setTenantStatus]", e);
    return { ok: false, error: "Status dəyişmədi" };
  }
}

/**
 * Impersonate a tenant — yalnız audit_log-a yazır. Faktiki sessiya dəyişikliyi
 * NextAuth-da edilməlidir; bu sadə implementasiya redirect ilə işarə verir.
 */
export async function impersonateTenant(sahibkar_id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  try {
    const target = await prismaUnscoped.sahibkarlar.findUnique({ where: { id: sahibkar_id }, select: { id: true, ad: true } });
    if (!target) return { ok: false, error: "Sahibkar tapılmadı" };
    await prismaUnscoped.audit_log.create({
      data: {
        sahibkar_id: target.id,
        istifadeci_id: admin.id,
        istifadeci_ad: admin.ad_soyad ?? "platform_admin",
        emeliyyat: "IMPERSONATE",
        resurs_nov: "sahibkar",
        resurs_id: target.id,
        yeni_data: { target_name: target.ad, at: new Date().toISOString() },
        sebeb: "Support/test üçün impersonate",
        status: "ugur",
      },
    });
  } catch (e) {
    console.error("[impersonateTenant]", e);
    return { ok: false, error: "Audit yazıla bilmədi" };
  }
  redirect("/dashboard");
}

const PlanSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  kod: z.string().min(1).max(30).regex(/^[a-z0-9_-]+$/i, "Yalnız hərf/rəqəm/_/-"),
  ad: z.string().min(1).max(80),
  ayl_q_qiymet: z.coerce.number().min(0).max(1000000),
  illik_qiymet: z.coerce.number().min(0).max(10000000).optional().or(z.literal("")),
  max_istifadeci: z.coerce.number().int().min(0).max(100000).optional().or(z.literal("")),
  max_mehsul: z.coerce.number().int().min(0).max(10000000).optional().or(z.literal("")),
  max_mesaj_ayl_q: z.coerce.number().int().min(0).max(10000000).optional().or(z.literal("")),
  storage_mb: z.coerce.number().int().min(0).max(10000000).optional().or(z.literal("")),
  aktiv: z.union([z.string(), z.boolean()]).optional(),
});

export async function savePlan(input: FormData): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  await requirePlatformAdmin();
  const parsed = PlanSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  try {
    const storage = typeof d.storage_mb === "number" ? d.storage_mb : null;
    const data = {
      kod: d.kod.toLowerCase(),
      ad: d.ad.trim(),
      ayl_q_qiymet: d.ayl_q_qiymet,
      illik_qiymet: typeof d.illik_qiymet === "number" ? d.illik_qiymet : null,
      max_istifadeci: typeof d.max_istifadeci === "number" ? d.max_istifadeci : null,
      max_mehsul: typeof d.max_mehsul === "number" ? d.max_mehsul : null,
      max_mesaj_ayl_q: typeof d.max_mesaj_ayl_q === "number" ? d.max_mesaj_ayl_q : null,
      funksiyalar: storage !== null ? { storage_mb: storage } : undefined,
      aktiv: d.aktiv === "on" || d.aktiv === "true" || d.aktiv === true,
    };
    let row;
    if (d.id) row = await prismaUnscoped.abune_planlari.update({ where: { id: d.id }, data });
    else row = await prismaUnscoped.abune_planlari.create({ data });
    revalidatePath("/platform-admin/paketler");
    return { ok: true, id: row.id };
  } catch (e) {
    console.error("[savePlan]", e);
    return { ok: false, error: "Yaddasaxlama alınmadı (kod təkrarlanır?)" };
  }
}

export async function deletePlan(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePlatformAdmin();
  try {
    const inUse = await prismaUnscoped.abuneler.count({ where: { plan_id: id, status: "aktiv" } });
    if (inUse > 0) return { ok: false, error: `Bu plan ${inUse} aktiv abunədə istifadədədir` };
    await prismaUnscoped.abune_planlari.delete({ where: { id } });
    revalidatePath("/platform-admin/paketler");
    return { ok: true };
  } catch (e) {
    console.error("[deletePlan]", e);
    return { ok: false, error: "Silinmədi" };
  }
}

export async function extendSubscription(sahibkar_id: string, daysToAdd: number): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePlatformAdmin();
  try {
    const latest = await prismaUnscoped.abuneler.findFirst({
      where: { sahibkar_id },
      orderBy: { yaradildi: "desc" },
    });
    if (!latest) return { ok: false, error: "Aktiv abunə tapılmadı" };
    const newBitme = new Date(latest.bitme);
    newBitme.setDate(newBitme.getDate() + daysToAdd);
    await prismaUnscoped.abuneler.update({
      where: { id: latest.id },
      data: { bitme: newBitme, status: "aktiv" },
    });
    revalidatePath(`/platform-admin/tenantlar/${sahibkar_id}`);
    return { ok: true };
  } catch (e) {
    console.error("[extendSubscription]", e);
    return { ok: false, error: "Uzatma alınmadı" };
  }
}
