"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

const UpdateSchema = z.object({
  id: z.string().uuid(),
  alish_qiymeti: z.coerce.number().min(0).optional(),
  satis_qiymeti: z.coerce.number().min(0).optional(),
  endirimli_qiymet: z.coerce.number().min(0).optional().nullable(),
  min_satis_qiymeti: z.coerce.number().min(0).optional(),
  topdan_qiymeti: z.coerce.number().min(0).optional(),
  partnyor_qiymeti: z.coerce.number().min(0).optional(),
  vip_qiymeti: z.coerce.number().min(0).optional(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updatePrices(input: z.input<typeof UpdateSchema>): Promise<ActionResult> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const { id, ...data } = parsed.data;
  return withTenant(async () => {
    try {
      await prisma.mehsullar.update({
        where: { id },
        data,
      });
      revalidatePath("/anbar/qiymet");
      revalidatePath(`/anbar/mehsullar/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[updatePrices]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const BulkSchema = z.array(UpdateSchema).max(500);

export async function bulkUpdatePrices(rows: z.input<typeof BulkSchema>): Promise<ActionResult> {
  const parsed = BulkSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  return withTenant(async () => {
    try {
      await prisma.$transaction(
        parsed.data.map(({ id, ...data }) =>
          prisma.mehsullar.update({ where: { id }, data })
        )
      );
      revalidatePath("/anbar/qiymet");
      return { ok: true };
    } catch (e) {
      console.error("[bulkUpdatePrices]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const BulkAdjustSchema = z.object({
  percent: z.coerce.number().min(-100).max(1000),
  field: z.enum([
    "alish_qiymeti",
    "satis_qiymeti",
    "endirimli_qiymet",
    "min_satis_qiymeti",
    "topdan_qiymeti",
    "partnyor_qiymeti",
    "vip_qiymeti",
  ]),
  /** When provided, only update those product ids; otherwise update all active products. */
  product_ids: z.array(z.string().uuid()).optional(),
});

export async function bulkAdjustPercent(input: z.input<typeof BulkAdjustSchema>): Promise<ActionResult> {
  const parsed = BulkAdjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { percent, field, product_ids } = parsed.data;
  return withTenant(async () => {
    try {
      const where = product_ids?.length
        ? { id: { in: product_ids } }
        : { aktiv: true };
      const products = (await prisma.mehsullar.findMany({
        where,
        select: { id: true, [field]: true } as never,
      })) as Array<{ id: string } & Record<string, unknown>>;
      const factor = 1 + percent / 100;
      await prisma.$transaction(
        products.map((p) => {
          const current = Number((p as Record<string, unknown>)[field] ?? 0);
          const newVal = Math.max(0, Math.round(current * factor * 100) / 100);
          return prisma.mehsullar.update({
            where: { id: p.id },
            data: { [field]: newVal },
          });
        })
      );
      revalidatePath("/anbar/qiymet");
      return { ok: true };
    } catch (e) {
      console.error("[bulkAdjustPercent]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pricing Rules — formula-based derivation
 *
 * Misal:
 *   target=topdan_qiymeti, source=satis_qiymeti, multiplier=0.9
 *     → hər məhsul üçün: topdan = satış × 0.9
 *
 *   target=satis_qiymeti, source=alish_qiymeti, multiplier=1.30
 *     → satış = maya × 1.30 (30% marja təminatı)
 * ────────────────────────────────────────────────────────────────────────── */
const PriceField = z.enum([
  "alish_qiymeti",
  "satis_qiymeti",
  "endirimli_qiymet",
  "min_satis_qiymeti",
  "topdan_qiymeti",
  "partnyor_qiymeti",
  "vip_qiymeti",
]);

const FormulaSchema = z.object({
  target: PriceField,
  source: PriceField,
  multiplier: z.coerce.number().gt(0).max(100), // 0.5–100x sınır
  /** Only overwrite when target is 0/null. Default false — always overwrite. */
  only_if_empty: z.coerce.boolean().optional(),
  /** Only update specific product ids. Default — all active. */
  product_ids: z.array(z.string().uuid()).optional(),
});

export async function applyPriceFormula(input: z.input<typeof FormulaSchema>): Promise<ActionResult & { count?: number }> {
  const parsed = FormulaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formula yanlışdır" };
  const { target, source, multiplier, only_if_empty, product_ids } = parsed.data;
  if (target === source) return { ok: false, error: "Hədəf və mənbə eyni ola bilməz" };
  return withTenant(async () => {
    try {
      const where = product_ids?.length
        ? { id: { in: product_ids } }
        : { aktiv: true };
      const products = (await prisma.mehsullar.findMany({
        where,
        select: { id: true, [target]: true, [source]: true } as never,
      })) as Array<{ id: string } & Record<string, unknown>>;

      const updates = products
        .map((p) => {
          const src = Number((p as Record<string, unknown>)[source] ?? 0);
          if (src <= 0) return null;
          const currentTarget = Number((p as Record<string, unknown>)[target] ?? 0);
          if (only_if_empty && currentTarget > 0) return null;
          const newVal = Math.max(0, Math.round(src * multiplier * 100) / 100);
          if (newVal === currentTarget) return null;
          return prisma.mehsullar.update({
            where: { id: p.id },
            data: { [target]: newVal },
          });
        })
        .filter(Boolean) as ReturnType<typeof prisma.mehsullar.update>[];

      await prisma.$transaction(updates);
      revalidatePath("/anbar/qiymet");
      return { ok: true, count: updates.length };
    } catch (e) {
      console.error("[applyPriceFormula]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}
