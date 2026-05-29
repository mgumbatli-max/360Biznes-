"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { KanalQiymetFormula } from "./types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/* ─────────────────────────── KANAL KOMISSIYA CRUD ──────────────────────── */

const KomissiyaSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  kanal: z.string().trim().min(2).max(40),
  komissiya_faiz: z.coerce.number().min(0).max(99.9).default(0),
  sabit_komissiya: z.coerce.number().min(0).max(1_000_000).default(0),
  catdirilma: z.coerce.number().min(0).max(1_000_000).default(0),
  bank_xerc: z.coerce.number().min(0).max(1_000_000).default(0),
  reklam_faiz: z.coerce.number().min(0).max(50).default(0),
  qaytarma_risk: z.coerce.number().min(0).max(50).default(0),
  stok_buffer: z.coerce.number().int().min(0).max(100_000).default(0),
  rate_limit_per_min: z.coerce.number().int().min(0).max(10_000).default(0),
  outbound_url: z.string().trim().url().optional().or(z.literal("")),
  outbound_secret: z.string().trim().max(200).optional().or(z.literal("")),
  auto_push_on_sale: z.coerce.boolean().default(false),
});

export async function saveKanalKomissiya(input: z.input<typeof KomissiyaSchema>): Promise<Result<{ id: number }>> {
  const parsed = KomissiyaSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Forma yanlışdır: ${issue?.path.join(".")} — ${issue?.message}` };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const data = {
        komissiya_faiz: d.komissiya_faiz,
        sabit_komissiya: d.sabit_komissiya,
        catdirilma: d.catdirilma,
        bank_xerc: d.bank_xerc,
        reklam_faiz: d.reklam_faiz,
        qaytarma_risk: d.qaytarma_risk,
      };
      // Extra ayarlar (stok buffer, rate limit, outbound URL) ayarlar cədvəlində — schema dəyişikliyi yoxdur
      const extraPayload = JSON.stringify({
        stok_buffer: d.stok_buffer,
        rate_limit_per_min: d.rate_limit_per_min,
        outbound_url: d.outbound_url?.trim() || null,
        outbound_secret: d.outbound_secret?.trim() || null,
        auto_push_on_sale: d.auto_push_on_sale,
      });
      await prisma.ayarlar.upsert({
        where: {
          sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "kanal_extra", acar: d.kanal },
        },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "kanal_extra",
          acar: d.kanal,
          deyer: extraPayload,
          nov: "string",
        },
        update: { deyer: extraPayload, yenilendi: new Date() },
      });
      if (d.id) {
        const row = await prisma.qiymet_kanal_komissiya.update({
          where: { id: d.id },
          data,
        });
        revalidatePath("/ayarlar/kanallar");
        return { ok: true, data: { id: row.id } };
      }
      const row = await prisma.qiymet_kanal_komissiya.upsert({
        where: { sahibkar_id_kanal: { sahibkar_id: sahibkarId, kanal: d.kanal } },
        create: { sahibkar_id: sahibkarId, kanal: d.kanal, ...data },
        update: data,
      });
      revalidatePath("/ayarlar/kanallar");
      return { ok: true, data: { id: row.id } };
    } catch (e) {
      console.error("[saveKanalKomissiya]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deleteKanalKomissiya(id: number): Promise<Result> {
  return withTenant(async () => {
    try {
      const row = await prisma.qiymet_kanal_komissiya.findUnique({ where: { id } });
      if (!row) return { ok: false, error: "Tapılmadı" };
      // Bu kanala bağlı bütün mehsul override-larını da sil
      await prisma.qiymet_kanal.deleteMany({
        where: { sahibkar_id: row.sahibkar_id, kanal: row.kanal },
      });
      await prisma.qiymet_kanal_komissiya.delete({ where: { id } });
      revalidatePath("/ayarlar/kanallar");
      return { ok: true };
    } catch (e) {
      console.error("[deleteKanalKomissiya]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

/* ─────────────────────────── MEHSUL × KANAL QIYMET ─────────────────────── */

const QiymetSchema = z.object({
  mehsul_id: z.string().uuid(),
  kanal: z.string().min(2).max(40),
  formula: z.enum(["baza", "auto_komissiya", "auto_net", "manual", "gizli"]),
  manual_qiymet: z.coerce.number().min(0).optional(),
  cached_qiymet: z.coerce.number().min(0).optional(), // preview üçün UI ötürür
});

export async function saveMehsulKanalQiymet(input: z.input<typeof QiymetSchema>): Promise<Result> {
  const parsed = QiymetSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Yanlış: ${issue?.path.join(".")} — ${issue?.message}` };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // formula="baza" → DB-də row yoxdur (varsa sil)
      if (d.formula === "baza") {
        await prisma.qiymet_kanal.deleteMany({
          where: { sahibkar_id: sahibkarId, mehsul_id: d.mehsul_id, kanal: d.kanal },
        });
      } else {
        const qiymet =
          d.formula === "manual"
            ? Number(d.manual_qiymet ?? 0)
            : d.formula === "gizli"
              ? 0
              : Number(d.cached_qiymet ?? 0);
        await prisma.qiymet_kanal.upsert({
          where: {
            sahibkar_id_mehsul_id_kanal: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              kanal: d.kanal,
            },
          },
          create: {
            sahibkar_id: sahibkarId,
            mehsul_id: d.mehsul_id,
            kanal: d.kanal,
            qiymet,
            formula_kod: d.formula,
            son_dey_id: istifadeciId,
            son_dey_tarix: new Date(),
          },
          update: {
            qiymet,
            formula_kod: d.formula,
            son_dey_id: istifadeciId,
            son_dey_tarix: new Date(),
          },
        });
      }
      revalidatePath(`/anbar/mehsullar/${d.mehsul_id}`);
      revalidatePath("/anbar/mehsullar");
      return { ok: true };
    } catch (e) {
      console.error("[saveMehsulKanalQiymet]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

/** Bulk: bir məhsulun bütün kanallarına eyni metodu tətbiq et. */
const BulkSchema = z.object({
  mehsul_id: z.string().uuid(),
  formula: z.enum(["baza", "auto_komissiya", "auto_net"]), // bulk-da manual mənalı deyil
});

/** Bulk: bir kanal üçün BÜTÜN məhsullara eyni metodu tətbiq et. */
const BulkAllProductsSchema = z.object({
  kanal: z.string().min(2).max(40),
  formula: z.enum(["baza", "auto_komissiya", "auto_net", "gizli"]),
  /** "force": mövcud manual qiymətləri də override edir. "skip_manual": manual saxlanılır. */
  mode: z.enum(["force", "skip_manual"]).default("skip_manual"),
});

export async function bulkApplyMethodToAllProducts(
  input: z.input<typeof BulkAllProductsSchema>,
): Promise<Result<{ updated: number; skipped: number; total: number }>> {
  const parsed = BulkAllProductsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const [kanal, products] = await Promise.all([
        prisma.qiymet_kanal_komissiya.findUnique({
          where: { sahibkar_id_kanal: { sahibkar_id: sahibkarId, kanal: d.kanal } },
        }),
        prisma.mehsullar.findMany({
          where: { sahibkar_id: sahibkarId, aktiv: true },
          select: { id: true, satis_qiymeti: true, min_satis_qiymeti: true },
        }),
      ]);
      if (!kanal) return { ok: false, error: "Kanal tapılmadı" };

      // formula="baza" → bu kanala aid bütün override-ları sil
      if (d.formula === "baza") {
        const deleted = await prisma.qiymet_kanal.deleteMany({
          where: {
            sahibkar_id: sahibkarId,
            kanal: d.kanal,
            ...(d.mode === "skip_manual" ? { formula_kod: { not: "manual" } } : {}),
          },
        });
        revalidatePath("/ayarlar/kanallar");
        return { ok: true, data: { updated: deleted.count, skipped: 0, total: products.length } };
      }

      // Mövcud manual-ları skip etmək üçün əvvəl onları çıxar
      let skippedManual = 0;
      let manualIds: Set<string> = new Set();
      if (d.mode === "skip_manual") {
        const manuals = await prisma.qiymet_kanal.findMany({
          where: { sahibkar_id: sahibkarId, kanal: d.kanal, formula_kod: "manual" },
          select: { mehsul_id: true },
        });
        manualIds = new Set(manuals.map((m) => m.mehsul_id));
        skippedManual = manualIds.size;
      }

      const { computeChannelPrice } = await import("./types");
      let updated = 0;
      const now = new Date();

      // Performance: parallel upsert chunks (qoy çox böyük transaksiya olmasın)
      const CHUNK = 50;
      for (let i = 0; i < products.length; i += CHUNK) {
        const slice = products.slice(i, i + CHUNK);
        const ops = slice
          .filter((p) => !manualIds.has(p.id))
          .map((p) => {
            const baza = Number(p.satis_qiymeti ?? 0);
            const q =
              d.formula === "gizli"
                ? 0
                : computeChannelPrice({
                    baza,
                    formula: d.formula,
                    komissiya_faiz: Number(kanal.komissiya_faiz ?? 0),
                    sabit_komissiya: Number(kanal.sabit_komissiya ?? 0),
                    catdirilma: Number(kanal.catdirilma ?? 0),
                    bank_xerc: Number(kanal.bank_xerc ?? 0),
                    min_qiymet: Number(p.min_satis_qiymeti ?? 0),
                  });
            return prisma.qiymet_kanal.upsert({
              where: {
                sahibkar_id_mehsul_id_kanal: {
                  sahibkar_id: sahibkarId,
                  mehsul_id: p.id,
                  kanal: d.kanal,
                },
              },
              create: {
                sahibkar_id: sahibkarId,
                mehsul_id: p.id,
                kanal: d.kanal,
                qiymet: q,
                formula_kod: d.formula,
                son_dey_id: istifadeciId,
                son_dey_tarix: now,
              },
              update: {
                qiymet: q,
                formula_kod: d.formula,
                son_dey_id: istifadeciId,
                son_dey_tarix: now,
              },
            });
          });
        await Promise.all(ops);
        updated += ops.length;
      }
      revalidatePath("/ayarlar/kanallar");
      revalidatePath("/anbar/mehsullar");
      return { ok: true, data: { updated, skipped: skippedManual, total: products.length } };
    } catch (e) {
      console.error("[bulkApplyMethodToAllProducts]", e);
      return { ok: false, error: "Tətbiq olunmadı" };
    }
  });
}

export async function bulkApplyMethodToAllChannels(input: z.input<typeof BulkSchema>): Promise<Result<{ count: number }>> {
  const parsed = BulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const [mehsul, kanallar] = await Promise.all([
        prisma.mehsullar.findFirst({
          where: { id: d.mehsul_id, sahibkar_id: sahibkarId },
          select: { satis_qiymeti: true },
        }),
        prisma.qiymet_kanal_komissiya.findMany({
          where: { sahibkar_id: sahibkarId },
        }),
      ]);
      if (!mehsul) return { ok: false, error: "Məhsul tapılmadı" };
      const baza = Number(mehsul.satis_qiymeti ?? 0);

      if (d.formula === "baza") {
        await prisma.qiymet_kanal.deleteMany({
          where: { sahibkar_id: sahibkarId, mehsul_id: d.mehsul_id },
        });
        revalidatePath(`/anbar/mehsullar/${d.mehsul_id}`);
        return { ok: true, data: { count: kanallar.length } };
      }

      const { computeChannelPrice } = await import("./types");
      let count = 0;
      for (const kk of kanallar) {
        const q = computeChannelPrice({
          baza,
          formula: d.formula,
          komissiya_faiz: Number(kk.komissiya_faiz ?? 0),
          sabit_komissiya: Number(kk.sabit_komissiya ?? 0),
          catdirilma: Number(kk.catdirilma ?? 0),
          bank_xerc: Number(kk.bank_xerc ?? 0),
        });
        await prisma.qiymet_kanal.upsert({
          where: {
            sahibkar_id_mehsul_id_kanal: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              kanal: kk.kanal,
            },
          },
          create: {
            sahibkar_id: sahibkarId,
            mehsul_id: d.mehsul_id,
            kanal: kk.kanal,
            qiymet: q,
            formula_kod: d.formula,
            son_dey_id: istifadeciId,
            son_dey_tarix: new Date(),
          },
          update: {
            qiymet: q,
            formula_kod: d.formula,
            son_dey_id: istifadeciId,
            son_dey_tarix: new Date(),
          },
        });
        count++;
      }
      revalidatePath(`/anbar/mehsullar/${d.mehsul_id}`);
      return { ok: true, data: { count } };
    } catch (e) {
      console.error("[bulkApplyMethodToAllChannels]", e);
      return { ok: false, error: "Tətbiq olunmadı" };
    }
  });
}
