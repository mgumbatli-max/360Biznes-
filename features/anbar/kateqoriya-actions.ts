"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

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
 * Kateqoriya yarat / yenilə / sil — yalnız sahibkar (rol_id=9) və admin (rol_id=1)
 * tərəfindən edilə bilər. Adi əməkdaş kataloq strukturuna toxuna bilməz.
 */
function isAllowed(rolId: number, icazeler: string[]): boolean {
  if (rolId === 1 || rolId === 9) return true;
  return icazeler.includes("anbar.kateqoriya_idare");
}

export async function createKateqoriya(input: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(input.entries());
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat" };

  return withTenant(async () => {
    const { sahibkarId, rolId, icazeler } = requireTenant();
    if (!isAllowed(rolId, icazeler)) {
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
    const { rolId, icazeler } = requireTenant();
    if (!isAllowed(rolId, icazeler)) {
      return { ok: false, error: "Yalnız sahibkar və admin kateqoriya redaktə edə bilər" };
    }
    try {
      await prisma.kateqoriyalar.update({
        where: { id: parsed.data.id },
        data: { ad: parsed.data.ad, ust_id: parsed.data.ust_id ?? null },
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
    const { rolId, icazeler } = requireTenant();
    if (!isAllowed(rolId, icazeler)) {
      return { ok: false, error: "Yalnız sahibkar və admin adı dəyişə bilər" };
    }
    try {
      await prisma.kateqoriyalar.update({
        where: { id: parsed.data.id },
        data: { ad: parsed.data.ad },
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
    const { rolId, icazeler } = requireTenant();
    if (!isAllowed(rolId, icazeler)) {
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
      await prisma.kateqoriyalar.delete({ where: { id } });
      revalidatePath("/anbar/kateqoriyalar");
      revalidateTag(`ref:${requireTenant().sahibkarId}:categories`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[deleteKateqoriya]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}
