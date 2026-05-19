"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true } | { ok: false; error: string };

const SendSchema = z.object({
  source_filial_id: z.coerce.number().int().positive(),
  target_filial_id: z.coerce.number().int().positive(),
  movzu: z.string().max(200).optional().or(z.literal("")),
  mesaj: z.string().min(1).max(5000),
  novu: z.enum(["umumi", "sorgu", "cavab", "sened", "telimat"]).default("umumi"),
  prioritet: z.enum(["asagi", "normal", "yuksek", "kritik"]).default("normal"),
  parent_id: z.coerce.number().int().positive().optional(),
});

export async function sendFilialMessage(input: FormData): Promise<ActionResult> {
  const parsed = SendSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  if (d.source_filial_id === d.target_filial_id) {
    return { ok: false, error: "Filial özünə mesaj göndərə bilməz" };
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const [source, target] = await Promise.all([
        prisma.filiallar.findFirst({ where: { id: d.source_filial_id, sahibkar_id: sahibkarId } }),
        prisma.filiallar.findFirst({ where: { id: d.target_filial_id, sahibkar_id: sahibkarId } }),
      ]);
      if (!source || !target) return { ok: false, error: "Filial tapılmadı" };

      await prisma.filial_mesaj.create({
        data: {
          sahibkar_id: sahibkarId,
          source_filial_id: d.source_filial_id,
          target_filial_id: d.target_filial_id,
          gonderici_id: istifadeciId ?? null,
          mesaj: d.mesaj.trim(),
          movzu: d.movzu?.trim() || null,
          novu: d.novu,
          prioritet: d.prioritet,
          parent_id: d.parent_id ?? null,
        },
      });
      revalidatePath("/ayarlar/filiallar");
      return { ok: true };
    } catch (e) {
      console.error("[sendFilialMessage]", e);
      return { ok: false, error: "Göndərilmədi" };
    }
  });
}

const ReadSchema = z.object({
  source_filial_id: z.coerce.number().int().positive(),
  target_filial_id: z.coerce.number().int().positive(),
});

export async function markFilialMessagesRead(input: FormData): Promise<ActionResult> {
  const parsed = ReadSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.filial_mesaj.updateMany({
        where: {
          sahibkar_id: sahibkarId,
          source_filial_id: d.target_filial_id, // mark messages FROM target
          target_filial_id: d.source_filial_id, // TO source as read
          oxundu: false,
        },
        data: {
          oxundu: true,
          oxuyan_id: istifadeciId ?? null,
          oxundu_de: new Date(),
        },
      });
      revalidatePath("/ayarlar/filiallar");
      return { ok: true };
    } catch (e) {
      console.error("[markFilialMessagesRead]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

export async function deleteFilialMessage(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.filial_mesaj.deleteMany({
        where: { id, sahibkar_id: sahibkarId },
      });
      revalidatePath("/ayarlar/filiallar");
      return { ok: true };
    } catch (e) {
      console.error("[deleteFilialMessage]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}
