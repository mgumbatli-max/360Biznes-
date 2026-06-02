"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";

const CreateSchema = z.object({
  ad: z.string().trim().min(1, "Ad mütləqdir").max(100),
  ust_id: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
});

const RenameSchema = z.object({
  id: z.coerce.number().int().positive(),
  ad: z.string().trim().min(1, "Ad mütləqdir").max(100),
});

const UpdateSchema = CreateSchema.extend({
  id: z.coerce.number().int().positive(),
});

type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

/**
 * Kateqoriya yarat / yenilə / sil — yalnız sahibkar və admin tərəfindən edilə bilər.
 * Adi əməkdaş kataloq strukturuna toxuna bilməz.
 */
function isAllowed(rolAd: string | undefined, icazeler: string[]): boolean {
  if (rolAd === "admin" || rolAd === "sahibkar") return true;
  return icazeler.includes("anbar.kateqoriya_idare");
}

export async function createKateqoriya(input: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(input.entries());
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat" };

  return withTenant(async () => {
    const { sahibkarId, rolAd, icazeler } = requireTenant();
    if (!isAllowed(rolAd, icazeler)) {
      return { ok: false, error: "Yalnız sahibkar və admin kateqoriya əlavə edə bilər" };
    }
    try {
      const row = await prisma.kateqoriyalar.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: parsed.data.ad,
          ust_id: parsed.data.ust_id ?? null,
        },
        select: { id: true },
      });
      await audit("yarat", "kateqoriya", row.id, { yeni_data: { ad: parsed.data.ad, ust_id: parsed.data.ust_id ?? null } });
      revalidatePath("/anbar/kateqoriyalar");
      revalidateTag(`ref:${sahibkarId}:categories`, "max");
      return { ok: true, id: row.id };
    } catch (e) {
      console.error("[createKateqoriya]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

export async function updateKateqoriya(input: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(input.entries());
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat" };

  return withTenant(async () => {
    const { rolAd, icazeler } = requireTenant();
    if (!isAllowed(rolAd, icazeler)) {
      return { ok: false, error: "Yalnız sahibkar və admin kateqoriya redaktə edə bilər" };
    }
    try {
      const before = await prisma.kateqoriyalar.findUnique({ where: { id: parsed.data.id }, select: { ad: true, ust_id: true } });
      await prisma.kateqoriyalar.update({
        where: { id: parsed.data.id },
        data: { ad: parsed.data.ad, ust_id: parsed.data.ust_id ?? null },
      });
      await audit("yenile", "kateqoriya", parsed.data.id, {
        evvelki_data: before as Record<string, unknown> | null,
        yeni_data: { ad: parsed.data.ad, ust_id: parsed.data.ust_id ?? null },
      });
      revalidatePath("/anbar/kateqoriyalar");
      revalidateTag(`ref:${requireTenant().sahibkarId}:categories`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[updateKateqoriya]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

/**
 * Sadəcə kateqoriya adını dəyişir (rename) — üst kateqoriyaya toxunmadan.
 * UI inline edit üçün istifadə olunur.
 */
export async function renameKateqoriya(id: number, ad: string): Promise<ActionResult> {
  const parsed = RenameSchema.safeParse({ id, ad });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat" };

  return withTenant(async () => {
    const { rolAd, icazeler } = requireTenant();
    if (!isAllowed(rolAd, icazeler)) {
      return { ok: false, error: "Yalnız sahibkar və admin adı dəyişə bilər" };
    }
    try {
      const before = await prisma.kateqoriyalar.findUnique({ where: { id: parsed.data.id }, select: { ad: true } });
      await prisma.kateqoriyalar.update({
        where: { id: parsed.data.id },
        data: { ad: parsed.data.ad },
      });
      await audit("yenile", "kateqoriya", parsed.data.id, {
        evvelki_data: { ad: before?.ad ?? null },
        yeni_data: { ad: parsed.data.ad },
        sebeb: "rename",
      });
      revalidatePath("/anbar/kateqoriyalar");
      revalidateTag(`ref:${requireTenant().sahibkarId}:categories`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[renameKateqoriya]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

export async function deleteKateqoriya(id: number): Promise<ActionResult> {
  return withTenant(async () => {
    const { rolAd, icazeler } = requireTenant();
    if (!isAllowed(rolAd, icazeler)) {
      return { ok: false, error: "Yalnız sahibkar və admin kateqoriya silə bilər" };
    }
    try {
      // Block deletion if products are still attached
      const inUse = await prisma.mehsullar.count({ where: { kateqoriya_id: id } });
      if (inUse > 0) {
        return { ok: false, error: `${inUse} məhsul bu kateqoriyada var — əvvəl köçürün` };
      }
      const subs = await prisma.kateqoriyalar.count({ where: { ust_id: id } });
      if (subs > 0) {
        return { ok: false, error: `${subs} alt-kateqoriya var — əvvəl onları silin` };
      }
      const before = await prisma.kateqoriyalar.findUnique({ where: { id }, select: { ad: true, ust_id: true } });
      await prisma.kateqoriyalar.delete({ where: { id } });
      await audit("sil", "kateqoriya", id, {
        evvelki_data: before as Record<string, unknown> | null,
        sebeb: "hard delete (boş kateqoriya)",
      });
      revalidatePath("/anbar/kateqoriyalar");
      revalidateTag(`ref:${requireTenant().sahibkarId}:categories`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[deleteKateqoriya]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}
