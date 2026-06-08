"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { audit } from "@/lib/audit/log";
import { requireAnbarActionPerm, bustAnbarCache } from "../access-guard";

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
  const permCheck = await requireAnbarActionPerm(["qiymet.idare", "mehsul.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const { id, ...data } = parsed.data;
  return withTenant(async () => {
    try {
      const before = await prisma.mehsullar.findUnique({
        where: { id },
        select: { ad: true, alish_qiymeti: true, satis_qiymeti: true, endirimli_qiymet: true, topdan_qiymeti: true, vip_qiymeti: true },
      });
      if (!before) return { ok: false, error: "Məhsul tapılmadı" };
      await prisma.mehsullar.update({ where: { id }, data });
      revalidatePath("/anbar/qiymet");
      revalidatePath("/pos");
      revalidatePath(`/anbar/mehsullar/${id}`);
      bustAnbarCache();
      await audit("yenile", "mehsul_qiymet", id, {
        evvelki_data: before as Record<string, unknown>,
        yeni_data: { ...data, ad: before.ad },
        sebeb: `Qiymət yeniləndi: ${before.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[updatePrices]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
    }
  });
}

const BulkSchema = z.array(UpdateSchema).max(500);

export async function bulkUpdatePrices(rows: z.input<typeof BulkSchema>): Promise<ActionResult> {
  const permCheck = await requireAnbarActionPerm(["qiymet.idare", "mehsul.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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
      revalidatePath("/pos");
      bustAnbarCache();
      // 💰 Bulk qiymət dəyişikliyi — kritik audit
      await audit("bulk_yenile", "mehsul_qiymet", null, {
        yeni_data: { rows: parsed.data.length },
        sebeb: `Toplu qiymət yeniləndi: ${parsed.data.length} məhsul`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[bulkUpdatePrices]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
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
  const permCheck = await requireAnbarActionPerm(["qiymet.idare", "mehsul.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = BulkAdjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { percent, field, product_ids } = parsed.data;
  // Cap on bulk size — 1000 məhsuldan çox olsa rədd
  if (product_ids && product_ids.length > 1000) {
    return { ok: false, error: "Bir dəfəyə 1000-dən çox məhsul olmamalıdır" };
  }
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
      revalidatePath("/pos");
      bustAnbarCache();
      await audit("bulk_adjust", "mehsul_qiymet", null, {
        yeni_data: { field, percent, sayi: products.length, target: product_ids ? "secilen" : "aktiv_hamı" },
        sebeb: `Toplu qiymət düzəlişi: ${field} ${percent > 0 ? "+" : ""}${percent}%`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[bulkAdjustPercent]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
    }
  });
}

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
  multiplier: z.coerce.number().gt(0).max(100),
  only_if_empty: z.coerce.boolean().optional(),
  product_ids: z.array(z.string().uuid()).optional(),
});

export async function applyPriceFormula(input: z.input<typeof FormulaSchema>): Promise<ActionResult & { count?: number }> {
  const permCheck = await requireAnbarActionPerm(["qiymet.idare", "mehsul.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = FormulaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Formula yanlışdır" };
  const { target, source, multiplier, only_if_empty, product_ids } = parsed.data;
  if (target === source) return { ok: false, error: "Hədəf və mənbə eyni ola bilməz" };
  if (product_ids && product_ids.length > 1000) return { ok: false, error: "Bir dəfəyə 1000-dən çox məhsul olmamalıdır" };
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
      revalidatePath("/pos");
      bustAnbarCache();
      await audit("formula", "mehsul_qiymet", null, {
        yeni_data: { target, source, multiplier, only_if_empty, etkilenen: updates.length, hedef_say: products.length },
        sebeb: `Qiymət formula tətbiq olundu: ${target} = ${source} × ${multiplier}`,
      });
      return { ok: true, count: updates.length };
    } catch (e) {
      console.error("[applyPriceFormula]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
    }
  });
}

/**
 * Preview — hansı məhsullara nə qədər təsir edəcək (write-siz).
 */
export type FormulaImpact = {
  etkilenen_say: number;
  hedef_say: number;
  numuneler: { id: string; ad: string; old: number; new: number; delta: number }[];
};

export async function previewPriceFormulaImpact(
  input: z.input<typeof FormulaSchema>,
): Promise<{ ok: true; data: FormulaImpact } | { ok: false; error: string }> {
  const permCheck = await requireAnbarActionPerm(["qiymet.idare", "mehsul.idare", "qiymet.oxu"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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
        select: { id: true, ad: true, [target]: true, [source]: true } as never,
        take: 1000,
      })) as Array<{ id: string; ad: string } & Record<string, unknown>>;

      let etkilenen = 0;
      const numuneler: { id: string; ad: string; old: number; new: number; delta: number }[] = [];
      for (const p of products) {
        const src = Number((p as Record<string, unknown>)[source] ?? 0);
        if (src <= 0) continue;
        const oldVal = Number((p as Record<string, unknown>)[target] ?? 0);
        if (only_if_empty && oldVal > 0) continue;
        const newVal = Math.max(0, Math.round(src * multiplier * 100) / 100);
        if (newVal === oldVal) continue;
        etkilenen++;
        if (numuneler.length < 20) {
          numuneler.push({ id: p.id, ad: p.ad, old: oldVal, new: newVal, delta: newVal - oldVal });
        }
      }
      return {
        ok: true,
        data: { etkilenen_say: etkilenen, hedef_say: products.length, numuneler },
      };
    } catch (e) {
      console.error("[previewPriceFormulaImpact]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Preview alınmadı: ${msg}` };
    }
  });
}
