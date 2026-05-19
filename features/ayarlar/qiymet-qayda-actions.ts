"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const ROUND_OPTIONS = ["0.99", "0.95", "0.50", "0.00"] as const;

const Schema = z.object({
  id: z.string().max(64).optional().or(z.literal("")),
  kateqoriya_id: z.string().optional().or(z.literal("")),
  ad: z.string().min(1).max(120),
  markup: z.coerce.number().min(-100).max(1000),
  round_to: z.enum(ROUND_OPTIONS),
  aktiv: z.union([z.string(), z.boolean()]).optional(),
});

type Rule = {
  id: string;
  ad: string;
  kateqoriya_id: number | null;
  markup: number;
  round_to: string;
  aktiv: boolean;
  yaradildi: string;
};

function genId() {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function getQiymetQaydalari(): Promise<{
  rules: Rule[];
  categories: { id: number; ad: string }[];
}> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [rows, kategoriler] = await Promise.all([
      prisma.ayarlar.findMany({
        where: { sahibkar_id: sahibkarId, qrup: "qiymet_qayda" },
        orderBy: { id: "asc" },
      }),
      prisma.kateqoriyalar.findMany({
        select: { id: true, ad: true },
        orderBy: { ad: "asc" },
        take: 200,
      }),
    ]);
    const rules: Rule[] = [];
    for (const r of rows) {
      if (!r.deyer) continue;
      try {
        const parsed = JSON.parse(r.deyer) as Rule;
        if (parsed?.id) rules.push(parsed);
      } catch {
        // skip
      }
    }
    return { rules, categories: kategoriler };
  });
}

export async function saveQiymetQayda(input: FormData): Promise<ActionResult> {
  const parsed = Schema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const id = d.id && d.id.trim() ? d.id.trim() : genId();
    const aktiv = d.aktiv === "on" || d.aktiv === "true" || d.aktiv === true;
    const kateqoriyaId = d.kateqoriya_id && d.kateqoriya_id.trim() ? Number(d.kateqoriya_id) : null;

    const rule: Rule = {
      id,
      ad: d.ad.trim(),
      kateqoriya_id: kateqoriyaId,
      markup: d.markup,
      round_to: d.round_to,
      aktiv,
      yaradildi: new Date().toISOString(),
    };

    try {
      await prisma.ayarlar.upsert({
        where: {
          sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "qiymet_qayda", acar: id },
        },
        update: { deyer: JSON.stringify(rule), nov: "json", yenilendi: new Date() },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "qiymet_qayda",
          acar: id,
          deyer: JSON.stringify(rule),
          nov: "json",
        },
      });
      revalidatePath("/ayarlar/qiymet");
      return { ok: true, id };
    } catch (e) {
      console.error("[saveQiymetQayda]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deleteQiymetQayda(input: FormData): Promise<ActionResult> {
  const id = String(input.get("id") ?? "");
  if (!id) return { ok: false, error: "Id yoxdur" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.ayarlar.delete({
        where: {
          sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "qiymet_qayda", acar: id },
        },
      });
      revalidatePath("/ayarlar/qiymet");
      return { ok: true };
    } catch (e) {
      console.error("[deleteQiymetQayda]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

/** Bulk-apply active rules to products: returns counts (mock — does NOT modify mehsullar). */
export async function bulkApplyQiymetQaydalari(): Promise<
  { ok: true; matched: number; rules: number } | { ok: false; error: string }
> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const rows = await prisma.ayarlar.findMany({
        where: { sahibkar_id: sahibkarId, qrup: "qiymet_qayda" },
      });
      let active = 0;
      const categoryIds: number[] = [];
      for (const r of rows) {
        if (!r.deyer) continue;
        try {
          const rule = JSON.parse(r.deyer) as Rule;
          if (rule.aktiv) {
            active += 1;
            if (rule.kateqoriya_id) categoryIds.push(rule.kateqoriya_id);
          }
        } catch {
          // skip
        }
      }
      // Count products that would be affected (preview only — no writes)
      let matched = 0;
      if (categoryIds.length > 0) {
        matched = await prisma.mehsullar.count({
          where: { aktiv: true, kateqoriya_id: { in: categoryIds } },
        });
      }
      return { ok: true, matched, rules: active };
    } catch (e) {
      console.error("[bulkApplyQiymetQaydalari]", e);
      return { ok: false, error: "Bulk apply alınmadı" };
    }
  });
}
