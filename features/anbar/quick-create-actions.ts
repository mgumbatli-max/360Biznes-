"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { requireAnbarActionPerm } from "./access-guard";
import { safeUserMessage } from "@/lib/error/user-message";

/**
 * Sürətli məhsul yaratma — alış qaiməsi və ya transfer içindən çağırılan
 * minimal sahələrlə yeni məhsul yaratma. Tam `saveProduct` axınından fərqi:
 *
 *  • 4-eyes təsdiq qatlanmır (alış qaiməsi içində akış kəsilməsin)
 *  • Yalnız ən vacib sahələr qəbul edir
 *  • Aktiv=true olaraq dərhal istifadə üçün hazırdır
 */

const QuickCreateProductSchema = z.object({
  ad: z.string().min(2).max(255),
  kod: z.string().max(100).optional().or(z.literal("")),
  barkod: z.string().max(100).optional().or(z.literal("")),
  marka_id: z.coerce.number().int().positive().optional().nullable(),
  kateqoriya_id: z.coerce.number().int().positive().optional().nullable(),
  alish_qiymeti: z.coerce.number().min(0).default(0),
  satis_qiymeti: z.coerce.number().min(0).default(0),
  min_stok: z.coerce.number().min(0).optional().nullable(),
});

export type QuickCreateProductInput = z.input<typeof QuickCreateProductSchema>;
export type QuickCreateProductResult =
  | {
      ok: true;
      product: {
        id: string;
        ad: string;
        kod: string | null;
        barkod: string | null;
        alish_qiymeti: number;
        satis_qiymeti: number;
        stok_miqdari: number;
      };
    }
  | { ok: false; error: string };

export async function quickCreateProduct(
  input: QuickCreateProductInput,
): Promise<QuickCreateProductResult> {
  const permCheck = await requireAnbarActionPerm("mehsul.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = QuickCreateProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Barkod / kod dublikatını yoxla — eyni tenant başına unikal
      if (d.barkod && d.barkod.trim()) {
        const dup = await prisma.mehsullar.findFirst({
          where: { sahibkar_id: sahibkarId, barkod: d.barkod.trim() },
          select: { id: true, ad: true },
        });
        if (dup) {
          return { ok: false, error: `Bu barkod artıq mövcuddur: ${dup.ad}` };
        }
      }
      if (d.kod && d.kod.trim()) {
        const dup = await prisma.mehsullar.findFirst({
          where: { sahibkar_id: sahibkarId, kod: d.kod.trim() },
          select: { id: true, ad: true },
        });
        if (dup) {
          return { ok: false, error: `Bu kod artıq mövcuddur: ${dup.ad}` };
        }
      }

      const created = await prisma.mehsullar.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: d.ad.trim(),
          kod: d.kod?.trim() || null,
          barkod: d.barkod?.trim() || null,
          marka_id: d.marka_id ?? null,
          kateqoriya_id: d.kateqoriya_id ?? null,
          alish_qiymeti: d.alish_qiymeti,
          satis_qiymeti: d.satis_qiymeti,
          min_stok: d.min_stok ?? null,
          valyuta: "AZN",
          aktiv: true,
        },
        select: {
          id: true,
          ad: true,
          kod: true,
          barkod: true,
          alish_qiymeti: true,
          satis_qiymeti: true,
        },
      });

      revalidatePath("/anbar/mehsullar");

      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "yarat_inline",
          resurs_nov: "mehsul",
          resurs_id: created.id,
          yeni_data: {
            ad: created.ad,
            kod: created.kod,
            barkod: created.barkod,
            alish_qiymeti: Number(created.alish_qiymeti ?? 0),
            satis_qiymeti: Number(created.satis_qiymeti ?? 0),
          },
          sebeb: "Alış qaiməsi / transfer içindən sürətli yaradıldı",
          status: "ugur",
        });
      } catch { /* non-fatal */ }

      return {
        ok: true,
        product: {
          id: created.id,
          ad: created.ad,
          kod: created.kod,
          barkod: created.barkod,
          alish_qiymeti: Number(created.alish_qiymeti ?? 0),
          satis_qiymeti: Number(created.satis_qiymeti ?? 0),
          stok_miqdari: 0,
        },
      };
    } catch (e) {
      console.error("[quickCreateProduct]", e);
      return { ok: false, error: safeUserMessage(e, "Məhsul yaradılmadı") };
    }
  });
}

/**
 * Marka / kateqoriya seçimi üçün lookup — minimal opsiyalar.
 */
export async function getQuickLookups(): Promise<{
  markalar: { id: number; ad: string }[];
  kateqoriyalar: { id: number; ad: string }[];
}> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [m, k] = await Promise.all([
      prisma.markalar.findMany({
        where: { sahibkar_id: sahibkarId },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true },
        take: 500,
      }),
      prisma.kateqoriyalar.findMany({
        where: { sahibkar_id: sahibkarId },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true },
        take: 500,
      }),
    ]);
    return { markalar: m, kateqoriyalar: k };
  });
}
