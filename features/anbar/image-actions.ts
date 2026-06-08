"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { audit } from "@/lib/audit/log";
import { requireAnbarActionPerm, bustAnbarCache, isValidImageUrl } from "./access-guard";

const UrlSchema = z.string().max(500).url().or(z.string().regex(/^\/uploads\/.+/));

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateProductImage(mehsulId: string, url: string | null): Promise<ActionResult> {
  const permCheck = await requireAnbarActionPerm(["mehsul.duzelt", "mehsul.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (url !== null) {
    const parsed = UrlSchema.safeParse(url);
    if (!parsed.success) return { ok: false, error: "Düzgün URL daxil edin" };
    // Yalnız allowlist-də olan hostlardan şəkil qəbul olunur (SSRF/cred theft müdafiə)
    if (!url.startsWith("/uploads/") && !isValidImageUrl(url)) {
      return { ok: false, error: "Bu host icazəli deyil. İcazəli: vercel-blob, cloudinary, imgur, AWS, öz domeniniz." };
    }
  }
  return withTenant(async () => {
    try {
      const before = await prisma.mehsullar.findUnique({
        where: { id: mehsulId },
        select: { ad: true, sekil_url: true },
      });
      if (!before) return { ok: false, error: "Məhsul tapılmadı" };
      await prisma.mehsullar.update({
        where: { id: mehsulId },
        data: { sekil_url: url, tesvir_yenilendi: new Date() },
      });
      revalidatePath("/anbar/mehsullar");
      revalidatePath(`/anbar/mehsullar/${mehsulId}`);
      bustAnbarCache();
      await audit("yenile", "mehsul_sekil", mehsulId, {
        evvelki_data: { sekil_url: before.sekil_url },
        yeni_data: { sekil_url: url, ad: before.ad },
        sebeb: url ? "Məhsul şəkli yeniləndi" : "Məhsul şəkli silindi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[updateProductImage]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
    }
  });
}
