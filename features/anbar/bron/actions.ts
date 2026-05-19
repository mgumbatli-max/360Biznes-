"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const CreateSchema = z.object({
  mehsul_id: z.string().uuid(),
  sayi: z.coerce.number().positive(),
  anbar_id: z.coerce.number().int().positive().optional().nullable(),
  musteri_id: z.string().uuid().optional().nullable(),
  musteri_ad: z.string().max(200).optional().nullable(),
  musteri_telefon: z.string().max(30).optional().nullable(),
  bitme_tarixi: z.string().optional().nullable(),
  qiymet: z.coerce.number().min(0).optional().nullable(),
  qeyd: z.string().max(1000).optional().nullable(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

function nz<T>(v: T | "" | null | undefined): T | null {
  return v === "" || v == null ? null : (v as T);
}

export async function createBron(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.stok_bron.create({
        data: {
          sahibkar_id: sahibkarId,
          mehsul_id: d.mehsul_id,
          sayi: d.sayi,
          anbar_id: nz(d.anbar_id) ?? null,
          musteri_id: nz(d.musteri_id) ?? null,
          musteri_ad: nz(d.musteri_ad),
          musteri_telefon: nz(d.musteri_telefon),
          bitme_tarixi: d.bitme_tarixi ? new Date(d.bitme_tarixi) : null,
          qiymet: d.qiymet ?? null,
          qeyd: nz(d.qeyd),
          yaradan_id: istifadeciId,
          status: "aktiv",
        },
      });
      revalidatePath("/anbar/bron");
      return { ok: true };
    } catch (e) {
      console.error("[createBron]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

export async function cancelBron(id: number): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.stok_bron.update({
        where: { id },
        data: { status: "legv" },
      });
      revalidatePath("/anbar/bron");
      return { ok: true };
    } catch (e) {
      console.error("[cancelBron]", e);
      return { ok: false, error: "Ləğv edilmədi" };
    }
  });
}
