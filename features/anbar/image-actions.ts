"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

const UrlSchema = z.string().max(500).url().or(z.string().regex(/^\/uploads\/.+/));

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateProductImage(mehsulId: string, url: string | null): Promise<ActionResult> {
  if (url !== null) {
    const parsed = UrlSchema.safeParse(url);
    if (!parsed.success) return { ok: false, error: "Düzgün URL daxil edin" };
  }
  return withTenant(async () => {
    try {
      await prisma.mehsullar.update({
        where: { id: mehsulId },
        data: { sekil_url: url, tesvir_yenilendi: new Date() },
      });
      revalidatePath("/anbar/mehsullar");
      revalidatePath(`/anbar/mehsullar/${mehsulId}`);
      return { ok: true };
    } catch (e) {
      console.error("[updateProductImage]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}
