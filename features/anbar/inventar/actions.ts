"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Sayım növləri:
 *  • tam     — anbardakı bütün aktiv məhsullar (full count)
 *  • secimli — yalnız seçilmiş kateqoriya və/və ya marka (cycle / partial count)
 *  • nokte   — yalnız əl ilə seçilmiş məhsullar (spot count)
 */
const CreateSchema = z.object({
  anbar_id: z.coerce.number().int().positive(),
  tip: z.enum(["tam", "secimli", "nokte"]).default("tam"),
  kateqoriya_id: z.coerce.number().int().positive().optional().nullable(),
  marka_id: z.coerce.number().int().positive().optional().nullable(),
  mehsul_ids: z.string().optional().nullable(),
  tarix: z.string().optional().nullable(),
  qeyd: z.string().max(1000).optional().nullable(),
});

async function nextInventarNo(sahibkarId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.inventarizasiyalar.count({
    where: { sahibkar_id: sahibkarId, tarix: { gte: new Date(`${year}-01-01`) } },
  });
  return `INV-${year}-${String(count + 1).padStart(5, "0")}`;
}

const TIP_LABEL: Record<string, string> = {
  tam: "Tam sayım",
  secimli: "Seçimli sayım",
  nokte: "Nöqtə sayım",
};

export async function createInventar(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const nomre = await nextInventarNo(sahibkarId);

      // ───── Snapshot tipinə görə filter qurulur ─────
      const mehsulWhere: Record<string, unknown> = { aktiv: true };
      if (d.tip === "secimli") {
        if (d.kateqoriya_id) mehsulWhere.kateqoriya_id = d.kateqoriya_id;
        if (d.marka_id) mehsulWhere.marka_id = d.marka_id;
      } else if (d.tip === "nokte") {
        const ids = (d.mehsul_ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        if (ids.length === 0) {
          return { ok: false, error: "Nöqtə sayım üçün ən azı bir məhsul seçilməlidir" };
        }
        mehsulWhere.id = { in: ids };
      }

      const stoks = await prisma.stok.findMany({
        where: { anbar_id: d.anbar_id, sahibkar_id: sahibkarId, mehsullar: { is: mehsulWhere } },
        include: { mehsullar: { select: { id: true, satis_qiymeti: true, alish_qiymeti: true, aktiv: true } } },
      });
      if (stoks.length === 0) {
        return { ok: false, error: "Seçimə uyğun məhsul tapılmadı" };
      }

      // Sayım növü qeyd sahəsinə prefiks kimi yazılır (DB-də ayrıca sütun yoxdur)
      const qeydParts = [`[${TIP_LABEL[d.tip] ?? "Sayım"}]`];
      if (d.qeyd) qeydParts.push(d.qeyd);
      const finalQeyd = qeydParts.join(" ").trim();

      const inv = await prisma.inventarizasiyalar.create({
        data: {
          sahibkar_id: sahibkarId,
          nomre,
          anbar_id: d.anbar_id,
          tarix: d.tarix ? new Date(d.tarix) : undefined,
          qeyd: finalQeyd,
          yaradan_id: istifadeciId,
          status: "aktiv",
          inventar_satirlari: {
            create: stoks.map((s) => ({
              sahibkar_id: sahibkarId,
              mehsul_id: s.mehsul_id!,
              sistemde_olan: s.miqdar ?? 0,
              qiymet: s.son_qiymet ?? s.mehsullar?.alish_qiymeti ?? 0,
            })),
          },
        },
      });
      revalidatePath("/anbar/inventar");
      return { ok: true, data: { id: inv.id } };
    } catch (e) {
      console.error("[createInventar]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

const UpdateRowSchema = z.object({
  satir_id: z.coerce.number().int().positive(),
  fakti_miqdar: z.coerce.number().min(0),
});

export async function updateInventarRow(input: z.input<typeof UpdateRowSchema>): Promise<ActionResult> {
  const parsed = UpdateRowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const d = parsed.data;
  return withTenant(async () => {
    try {
      await prisma.inventar_satirlari.update({
        where: { id: d.satir_id },
        data: { fakti_miqdar: d.fakti_miqdar },
      });
      return { ok: true };
    } catch (e) {
      console.error("[updateInventarRow]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

export async function bulkUpdateInventarRows(rows: Array<{ satir_id: number; fakti_miqdar: number }>): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.$transaction(
        rows.map((r) =>
          prisma.inventar_satirlari.update({
            where: { id: r.satir_id },
            data: { fakti_miqdar: r.fakti_miqdar },
          })
        )
      );
      return { ok: true };
    } catch (e) {
      console.error("[bulkUpdateInventarRows]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function completeInventar(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.$transaction(async (tx) => {
        const inv = await tx.inventarizasiyalar.findUnique({
          where: { id },
          include: { inventar_satirlari: true },
        });
        if (!inv) throw new Error("Tapılmadı");
        if (inv.status !== "aktiv") throw new Error("Aktiv deyil");

        for (const r of inv.inventar_satirlari) {
          if (r.fakti_miqdar == null) continue;
          const fakti = Number(r.fakti_miqdar);
          const sistemde = Number(r.sistemde_olan);
          const ferq = fakti - sistemde;
          if (ferq === 0) continue;

          // Update stok to fakti
          const s = await tx.stok.findFirst({
            where: { mehsul_id: r.mehsul_id, anbar_id: inv.anbar_id },
          });
          if (s) {
            await tx.stok.update({ where: { id: s.id }, data: { miqdar: fakti } });
          } else if (fakti > 0) {
            await tx.stok.create({
              data: { sahibkar_id: sahibkarId, mehsul_id: r.mehsul_id, anbar_id: inv.anbar_id, miqdar: fakti },
            });
          }

          // Movement record (inventar correction)
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: inv.anbar_id,
              mehsul_id: r.mehsul_id,
              nov: "inventar",
              miqdar: Math.abs(ferq),
              qiymet: r.qiymet ?? 0,
              ref_nov: "inventar",
              ref_id: inv.id,
              edilen_id: istifadeciId,
              qeyd: `İnventar ${inv.nomre}: sistem ${sistemde} → fakt ${fakti}`,
            },
          });
        }

        await tx.inventarizasiyalar.update({
          where: { id },
          data: { status: "tamamlandi", tamamlanan_id: istifadeciId },
        });
      });
      revalidatePath("/anbar/inventar");
      revalidatePath(`/anbar/inventar/${id}`);
      revalidatePath("/anbar/hereketler");

      // İnventarizasiya tamamlandı — stoku dəyişən məhsulları kanal-larına sync
      try {
        const inv = await prisma.inventarizasiyalar.findUnique({
          where: { id },
          include: { inventar_satirlari: { select: { mehsul_id: true, fakti_miqdar: true, sistemde_olan: true } } },
        });
        if (inv) {
          const changedIds = inv.inventar_satirlari
            .filter((r) => r.fakti_miqdar != null && Number(r.fakti_miqdar) !== Number(r.sistemde_olan))
            .map((r) => r.mehsul_id);
          const { emitStockChange } = await import("@/lib/stock-change-emitter");
          emitStockChange(changedIds);
        }
      } catch (e) {
        console.error("[completeInventar.emitStockChange]", e);
      }

      return { ok: true };
    } catch (e) {
      console.error("[completeInventar]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

export async function cancelInventar(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.inventarizasiyalar.update({
        where: { id },
        data: { status: "legv" },
      });
      revalidatePath("/anbar/inventar");
      revalidatePath(`/anbar/inventar/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[cancelInventar]", e);
      return { ok: false, error: "Ləğv edilmədi" };
    }
  });
}
