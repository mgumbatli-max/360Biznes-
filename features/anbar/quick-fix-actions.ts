"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { audit } from "@/lib/audit/log";
import { requireAnbarActionPerm, bustAnbarCache } from "./access-guard";
import { safeUserMessage } from "@/lib/error/user-message";

type ActionResult = { ok: true } | { ok: false; error: string };

const BarcodeSchema = z.object({
  id: z.string().uuid(),
  barkod: z.string().min(3).max(100),
});

export async function setProductBarcode(input: z.input<typeof BarcodeSchema>): Promise<ActionResult> {
  const permCheck = await requireAnbarActionPerm(["mehsul.duzelt", "mehsul.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = BarcodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Barkod düzgün deyil" };
  const { id, barkod } = parsed.data;
  return withTenant(async () => {
    try {
      const before = await prisma.mehsullar.findUnique({
        where: { id },
        select: { ad: true, barkod: true },
      });
      if (!before) return { ok: false, error: "Məhsul tapılmadı" };
      await prisma.mehsullar.update({ where: { id }, data: { barkod: barkod.trim() } });
      revalidatePath("/anbar/mehsullar");
      revalidatePath("/anbar/hesabat");
      revalidatePath(`/anbar/mehsullar/${id}`);
      bustAnbarCache();
      await audit("yenile", "mehsul_barkod", id, {
        evvelki_data: { barkod: before.barkod },
        yeni_data: { barkod: barkod.trim(), ad: before.ad },
        sebeb: "Quick-fix: barkod yeniləndi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[setProductBarcode]", e);
      return { ok: false, error: safeUserMessage(e, "Barkod yenilənmədi") };
    }
  });
}

const NumberFieldSchema = z.object({
  id: z.string().uuid(),
  value: z.coerce.number().min(0),
});

export async function setProductCost(input: z.input<typeof NumberFieldSchema>): Promise<ActionResult> {
  // KRİTİK: maya qiymət dəyişikliyi — qiymət icaze tələb olunur
  const permCheck = await requireAnbarActionPerm(["qiymet.idare", "mehsul.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = NumberFieldSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { id, value } = parsed.data;
  return withTenant(async () => {
    try {
      const before = await prisma.mehsullar.findUnique({
        where: { id },
        select: { ad: true, alish_qiymeti: true },
      });
      if (!before) return { ok: false, error: "Məhsul tapılmadı" };
      await prisma.mehsullar.update({ where: { id }, data: { alish_qiymeti: value } });
      revalidatePath("/anbar/mehsullar");
      revalidatePath("/anbar/hesabat");
      revalidatePath(`/anbar/mehsullar/${id}`);
      bustAnbarCache();
      // 💰 Maya qiymət dəyişikliyi — kritik audit (marjaya təsir edir)
      await audit("yenile", "mehsul_maya", id, {
        evvelki_data: { alish_qiymeti: Number(before.alish_qiymeti ?? 0) },
        yeni_data: { alish_qiymeti: value, ad: before.ad },
        sebeb: "Quick-fix: maya qiyməti yeniləndi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[setProductCost]", e);
      return { ok: false, error: safeUserMessage(e, "Maya qiyməti yenilənmədi") };
    }
  });
}

export async function setProductSalePrice(input: z.input<typeof NumberFieldSchema>): Promise<ActionResult> {
  const permCheck = await requireAnbarActionPerm(["qiymet.idare", "mehsul.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = NumberFieldSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { id, value } = parsed.data;
  return withTenant(async () => {
    try {
      const before = await prisma.mehsullar.findUnique({
        where: { id },
        select: { ad: true, satis_qiymeti: true },
      });
      if (!before) return { ok: false, error: "Məhsul tapılmadı" };
      await prisma.mehsullar.update({ where: { id }, data: { satis_qiymeti: value } });
      revalidatePath("/anbar/mehsullar");
      revalidatePath("/anbar/hesabat");
      revalidatePath("/pos");
      revalidatePath(`/anbar/mehsullar/${id}`);
      bustAnbarCache();
      await audit("yenile", "mehsul_satis_qiymet", id, {
        evvelki_data: { satis_qiymeti: Number(before.satis_qiymeti ?? 0) },
        yeni_data: { satis_qiymeti: value, ad: before.ad },
        sebeb: "Quick-fix: satış qiyməti yeniləndi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[setProductSalePrice]", e);
      return { ok: false, error: safeUserMessage(e, "Satış qiyməti yenilənmədi") };
    }
  });
}
