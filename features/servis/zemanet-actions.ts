"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult<T = undefined> = { ok: true; id?: string; data?: T } | { ok: false; error: string };

const ZemanetSchema = z.object({
  musteri_id: z.string().uuid().optional().or(z.literal("")),
  musteri_ad: z.string().min(2).max(200),
  musteri_telefon: z.string().min(5).max(50).optional().or(z.literal("")),
  mehsul_id: z.string().uuid().optional().or(z.literal("")),
  mehsul_ad: z.string().min(2).max(255),
  serial_nomre: z.string().max(100).optional().or(z.literal("")),
  imei: z.string().max(50).optional().or(z.literal("")),
  baslama_tarixi: z.string(),
  ay_sayi: z.coerce.number().int().positive().max(120),
  satis_qiymeti: z.coerce.number().min(0).optional(),
  qeyd: z.string().optional(),
});

async function nextUnikalKod(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.zemanetler.findFirst({
    where: { unikal_kod: { startsWith: `Z-${year}-` } },
    orderBy: { unikal_kod: "desc" },
    select: { unikal_kod: true },
  });
  const lastNum = last ? Number(last.unikal_kod.split("-").pop()) || 0 : 0;
  return `Z-${year}-${String(lastNum + 1).padStart(5, "0")}`;
}

export async function createZemanet(input: FormData): Promise<ActionResult> {
  const parsed = ZemanetSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const unikal_kod = await nextUnikalKod();
      const qr_token = crypto.randomBytes(24).toString("hex");
      const baslama = new Date(d.baslama_tarixi);
      const bitme = new Date(baslama);
      bitme.setMonth(bitme.getMonth() + d.ay_sayi);

      const created = await prisma.zemanetler.create({
        data: {
          sahibkar_id: sahibkarId,
          unikal_kod,
          qr_token,
          musteri_id: d.musteri_id || null,
          musteri_ad: d.musteri_ad.trim(),
          musteri_telefon: d.musteri_telefon?.trim() || null,
          mehsul_id: d.mehsul_id || null,
          mehsul_ad: d.mehsul_ad.trim(),
          serial_nomre: d.serial_nomre || null,
          imei: d.imei || null,
          baslama_tarixi: baslama,
          bitme_tarixi: bitme,
          ay_sayi: d.ay_sayi,
          satis_qiymeti: d.satis_qiymeti ?? null,
          qeyd: d.qeyd ?? null,
          status: "aktiv",
          yaradan_id: istifadeciId,
        },
      });
      revalidatePath("/servis/zemanet");
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[createZemanet]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

export async function deactivateZemanet(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.zemanetler.update({
        where: { id },
        data: { status: "ləğv", yenilendi: new Date() },
      });
      revalidatePath("/servis/zemanet");
      return { ok: true };
    } catch (e) {
      console.error("[deactivateZemanet]", e);
      return { ok: false, error: "Ləğv olunmadı" };
    }
  });
}

/**
 * Creates a new servis_qeydleri linked to a warranty.
 */
export async function createServisFromZemanet(zemanetId: string, problem: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const z = await prisma.zemanetler.findUnique({ where: { id: zemanetId } });
      if (!z) return { ok: false, error: "Zəmanət tapılmadı" };

      const year = new Date().getFullYear();
      const last = await prisma.servis_qeydleri.findFirst({
        where: { nomre: { startsWith: `SR-${year}-` } },
        orderBy: { nomre: "desc" },
        select: { nomre: true },
      });
      const lastNum = last ? Number(last.nomre.split("-").pop()) || 0 : 0;
      const nomre = `SR-${year}-${String(lastNum + 1).padStart(5, "0")}`;

      const created = await prisma.servis_qeydleri.create({
        data: {
          sahibkar_id: sahibkarId,
          nomre,
          musteri_id: z.musteri_id,
          musteri_ad: z.musteri_ad ?? "—",
          musteri_telefon: z.musteri_telefon ?? "—",
          mehsul_id: z.mehsul_id,
          mehsul_ad: z.mehsul_ad ?? "—",
          mehsul_seri_nomresi: z.serial_nomre ?? z.imei,
          problem_tesviri: problem || "Zəmanət əsasında servis qəbulu",
          qebul_eden_id: istifadeciId,
          status: "qebul_edildi",
          zemanet_var: true,
          zemanet_baslama: z.baslama_tarixi,
          zemanet_bitme: z.bitme_tarixi,
        },
      });
      await prisma.zemanetler.update({
        where: { id: zemanetId },
        data: { servis_id: created.id, yenilendi: new Date() },
      });
      revalidatePath("/servis");
      revalidatePath("/servis/zemanet");
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[createServisFromZemanet]", e);
      return { ok: false, error: "Servis qeydi yaradılmadı" };
    }
  });
}

export async function printZemanetPdf(id: string): Promise<ActionResult<{ url: string }>> {
  return { ok: true, data: { url: `/api/zemanet/${id}/talon.pdf` } };
}
