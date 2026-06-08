"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireHrActionPerm, bustHrCache } from "./access-guard";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const VezifeSchema = z.object({
  ad: z.string().min(2, "Vəzifə adı ən az 2 simvol olmalıdır").max(150),
});

export async function createVezife(
  ad: string,
): Promise<ActionResult<{ id: number; ad: string }>> {
  const perm = await requireHrActionPerm("isci.idare");
  if (!perm.ok) return { ok: false, error: perm.error };

  const parsed = VezifeSchema.safeParse({ ad });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış" };
  }

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const trimmed = parsed.data.ad.trim();
      const existing = await prisma.vezifeler.findFirst({
        where: { sahibkar_id: sahibkarId, ad: { equals: trimmed, mode: "insensitive" } },
        select: { id: true, ad: true, aktiv: true },
      });
      if (existing) {
        if (!existing.aktiv) {
          await prisma.vezifeler.update({
            where: { id: existing.id },
            data: { aktiv: true },
          });
        }
        return { ok: true, data: { id: existing.id, ad: existing.ad } };
      }
      const created = await prisma.vezifeler.create({
        data: { sahibkar_id: sahibkarId, ad: trimmed },
        select: { id: true, ad: true },
      });
      try {
        await audit("yarat", "vezife", String(created.id), {
          yeni_data: { ad: created.ad },
          sebeb: "Yeni vəzifə əlavə olundu",
        });
      } catch { /* non-fatal */ }
      revalidatePath("/ayarlar/vezife");
      revalidatePath("/iscilier");
      bustHrCache();
      return { ok: true, data: { id: created.id, ad: created.ad } };
    } catch (e) {
      console.error("[createVezife]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function updateVezife(id: number, ad: string): Promise<ActionResult> {
  const perm = await requireHrActionPerm("isci.idare");
  if (!perm.ok) return { ok: false, error: perm.error };
  const parsed = VezifeSchema.safeParse({ ad });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış" };
  }
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const before = await prisma.vezifeler.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        select: { ad: true },
      });
      if (!before) return { ok: false, error: "Tapılmadı" };
      await prisma.vezifeler.updateMany({
        where: { id, sahibkar_id: sahibkarId },
        data: { ad: parsed.data.ad.trim() },
      });
      try {
        await audit("yenile", "vezife", String(id), {
          evvelki_data: { ad: before.ad },
          yeni_data: { ad: parsed.data.ad.trim() },
          sebeb: "Vəzifə adı dəyişdirildi",
        });
      } catch { /* non-fatal */ }
      revalidatePath("/ayarlar/vezife");
      revalidatePath("/iscilier");
      bustHrCache();
      return { ok: true };
    } catch (e) {
      console.error("[updateVezife]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function toggleVezifeAktiv(id: number): Promise<ActionResult> {
  const perm = await requireHrActionPerm("isci.idare");
  if (!perm.ok) return { ok: false, error: perm.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const v = await prisma.vezifeler.findFirst({
      where: { id, sahibkar_id: sahibkarId },
      select: { aktiv: true, ad: true },
    });
    if (!v) return { ok: false, error: "Tapılmadı" };
    await prisma.vezifeler.updateMany({
      where: { id, sahibkar_id: sahibkarId },
      data: { aktiv: !v.aktiv },
    });
    try {
      await audit("yenile", "vezife", String(id), {
        evvelki_data: { aktiv: v.aktiv },
        yeni_data: { aktiv: !v.aktiv },
        sebeb: v.aktiv ? "Vəzifə deaktivləşdi" : "Vəzifə aktivləşdi",
      });
    } catch { /* non-fatal */ }
    revalidatePath("/ayarlar/vezife");
    revalidatePath("/iscilier");
    bustHrCache();
    return { ok: true };
  });
}
