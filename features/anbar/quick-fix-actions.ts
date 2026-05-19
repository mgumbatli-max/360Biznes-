"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

type ActionResult = { ok: true } | { ok: false; error: string };

const BarcodeSchema = z.object({
  id: z.string().uuid(),
  barkod: z.string().min(3).max(100),
});

export async function setProductBarcode(input: z.input<typeof BarcodeSchema>): Promise<ActionResult> {
  const parsed = BarcodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Barkod düzgün deyil" };
  const { id, barkod } = parsed.data;
  return withTenant(async () => {
    try {
      await prisma.mehsullar.update({ where: { id }, data: { barkod: barkod.trim() } });
      revalidatePath("/anbar/mehsullar");
      revalidatePath("/anbar/hesabat");
      revalidatePath(`/anbar/mehsullar/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[setProductBarcode]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const NumberFieldSchema = z.object({
  id: z.string().uuid(),
  value: z.coerce.number().min(0),
});

export async function setProductCost(input: z.input<typeof NumberFieldSchema>): Promise<ActionResult> {
  const parsed = NumberFieldSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { id, value } = parsed.data;
  return withTenant(async () => {
    try {
      await prisma.mehsullar.update({ where: { id }, data: { alish_qiymeti: value } });
      revalidatePath("/anbar/mehsullar");
      revalidatePath("/anbar/hesabat");
      revalidatePath(`/anbar/mehsullar/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[setProductCost]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

export async function setProductSalePrice(input: z.input<typeof NumberFieldSchema>): Promise<ActionResult> {
  const parsed = NumberFieldSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { id, value } = parsed.data;
  return withTenant(async () => {
    try {
      await prisma.mehsullar.update({ where: { id }, data: { satis_qiymeti: value } });
      revalidatePath("/anbar/mehsullar");
      revalidatePath("/anbar/hesabat");
      revalidatePath(`/anbar/mehsullar/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[setProductSalePrice]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}
