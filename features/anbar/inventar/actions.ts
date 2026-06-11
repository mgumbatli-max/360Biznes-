"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { safeUserMessage } from "@/lib/error/user-message";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | {
      ok: false;
      error: string;
      blockers?: import("@/lib/blockers/types").Blocker[];
      hint?: string;
    };

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
  const { requireAnbarActionPerm } = await import("../access-guard");
  const permCheck = await requireAnbarActionPerm(["inventar.idare", "stok.idare", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = CreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  // 📅 Real-time tarix məcburiyyəti — sayım tarixi gələcəkdə ola bilməz
  const { validateOperationDate } = await import("@/lib/operation-date-guard");
  const dateCheck = await validateOperationDate(d.tarix, { fieldLabel: "Sayım tarixi" });
  if (!dateCheck.ok) return { ok: false, error: dateCheck.error };

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
      await audit("yarat", "inventarizasiya", inv.id, {
        yeni_data: {
          nomre,
          anbar_id: d.anbar_id,
          tip: d.tip,
          line_count: stoks.length,
          kateqoriya_id: d.kateqoriya_id ?? null,
          marka_id: d.marka_id ?? null,
        },
        sebeb: d.qeyd || `Sayım başladıldı: ${TIP_LABEL[d.tip] ?? d.tip}`,
      });
      revalidatePath("/anbar/inventar");
      return { ok: true, data: { id: inv.id } };
    } catch (e) {
      console.error("[createInventar]", e);
      return { ok: false, error: safeUserMessage(e, "Sayım yaradılmadı") };
    }
  });
}

const UpdateRowSchema = z.object({
  satir_id: z.coerce.number().int().positive(),
  fakti_miqdar: z.coerce.number().min(0),
});

export async function updateInventarRow(input: z.input<typeof UpdateRowSchema>): Promise<ActionResult> {
  const { requireAnbarActionPerm } = await import("../access-guard");
  const permCheck = await requireAnbarActionPerm(["inventar.idare", "stok.idare", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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
      return { ok: false, error: safeUserMessage(e, "Sətir yenilənmədi") };
    }
  });
}

export async function bulkUpdateInventarRows(rows: Array<{ satir_id: number; fakti_miqdar: number }>): Promise<ActionResult> {
  const { requireAnbarActionPerm } = await import("../access-guard");
  const permCheck = await requireAnbarActionPerm(["inventar.idare", "stok.idare", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (rows.length > 1000) return { ok: false, error: "1000-dən çox sətir ola bilməz" };
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
      return { ok: false, error: safeUserMessage(e, "Sayım sətrləri yadda saxlanmadı") };
    }
  });
}

/**
 * Fərqi olan sətrlərə səbəb (variance reason) yaz.
 * Səbəb mövcud `qeyd` field-ində `[SEBEB:kod]` prefiksi ilə saxlanır
 * (migration tələb etməmək üçün).
 */
export async function setInventarRowReasons(
  rows: Array<{ satir_id: number; sebeb: string | null; aciqlama: string }>,
): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      const { buildVarianceQeyd } = await import("./variance-reasons");
      await prisma.$transaction(
        rows.map((r) =>
          prisma.inventar_satirlari.update({
            where: { id: r.satir_id },
            data: { qeyd: buildVarianceQeyd(r.sebeb as never, r.aciqlama) },
          }),
        ),
      );
      return { ok: true };
    } catch (e) {
      console.error("[setInventarRowReasons]", e);
      return { ok: false, error: safeUserMessage(e, "Səbəb yazılmadı") };
    }
  });
}

export async function completeInventar(id: string, opts?: { allowMissingReasons?: boolean }): Promise<ActionResult & { missingReasonCount?: number }> {
  const { requireAnbarActionPerm } = await import("../access-guard");
  // 💰 İnventar tamamlama = variance write-off, pul ekvivalenti
  const permCheck = await requireAnbarActionPerm(["inventar.idare", "stok.idare", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const { parseVarianceQeyd, reasonToExpenseCategory } = await import("./variance-reasons");
    try {
      // İlk yoxlama: hər fərqi olan sətrin səbəbi varmı? (transaction-dan ƏVVƏL)
      const preInv = await prisma.inventarizasiyalar.findUnique({
        where: { id },
        include: { inventar_satirlari: true },
      });
      if (!preInv) return { ok: false, error: "Tapılmadı" };
      const varianceRows = preInv.inventar_satirlari.filter((r) => {
        if (r.fakti_miqdar == null) return false;
        return Number(r.fakti_miqdar) !== Number(r.sistemde_olan);
      });
      const withoutReason = varianceRows.filter((r) => !parseVarianceQeyd(r.qeyd).sebeb);
      if (withoutReason.length > 0 && !opts?.allowMissingReasons) {
        return {
          ok: false,
          error: `${withoutReason.length} fərqi olan sətrin səbəbi göstərilməyib`,
          missingReasonCount: withoutReason.length,
        };
      }

      // Maliyyə təsiri toplamı — sayım zərəri kateqoriyalarına görə
      const expenseBuckets = new Map<string, { mebleg: number; details: string[] }>();
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

          const { sebeb } = parseVarianceQeyd(r.qeyd);

          // Update stok to fakti
          const s = await tx.stok.findFirst({
            where: { mehsul_id: r.mehsul_id, anbar_id: inv.anbar_id },
          });
          if (s) {
            // QA-orta: mütləq force-set əvəzinə NİSBİ delta — sayım snapshot-u ilə
            // tamamlama arasındakı satış/medaxil itməsin, cache = ledger invariantı qorunsun.
            await tx.stok.update({ where: { id: s.id }, data: { miqdar: { increment: ferq } } });
          } else if (fakti > 0) {
            await tx.stok.create({
              data: { sahibkar_id: sahibkarId, mehsul_id: r.mehsul_id, anbar_id: inv.anbar_id, miqdar: fakti },
            });
          }

          // Movement record (inventar correction) — SIGNED delta
          // ferq > 0 → artım (stoka əlavə), ferq < 0 → azalma (çıxış).
          // Source-of-truth bu növləri ayrı işarə ilə hesablayır.
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: inv.anbar_id,
              mehsul_id: r.mehsul_id,
              nov: ferq > 0 ? "inventar_artim" : "inventar_azalma",
              miqdar: Math.abs(ferq),
              qiymet: r.qiymet ?? 0,
              ref_nov: "inventar",
              ref_id: inv.id,
              edilen_id: istifadeciId,
              qeyd: `İnventar ${inv.nomre}: sistem ${sistemde} → fakt ${fakti} (${sebeb ?? "—"})`,
            },
          });

          // Maliyyə təsiri — yalnız mənfi fərqdə və real xərc kateqoriyasında
          if (ferq < 0) {
            const expenseCat = reasonToExpenseCategory(sebeb);
            if (expenseCat) {
              const unitCost = Number(r.qiymet ?? 0);
              const loss = Math.abs(ferq) * unitCost;
              if (loss > 0) {
                const bucket = expenseBuckets.get(expenseCat) ?? { mebleg: 0, details: [] };
                bucket.mebleg += loss;
                bucket.details.push(`${Math.abs(ferq).toFixed(2)} × ${unitCost.toFixed(2)} ₼`);
                expenseBuckets.set(expenseCat, bucket);
              }
            }
          }
        }

        // Maliyyə xərc qeydləri — sayım zərəri (xerc_kateqoriyalari + xercl_r)
        for (const [catKod, bucket] of expenseBuckets) {
          if (bucket.mebleg <= 0) continue;
          const catName = catKod === "anbar_ogurluq" ? "Anbar oğurluq"
            : catKod === "anbar_zerer" ? "Anbar zərər/damage"
            : catKod === "anbar_daxili_istifade" ? "Anbar daxili istifadə"
            : "Anbar digər zərər";
          // Kateqoriyanı ad üzrə tap və ya yarad (kod field yoxdur, ad üzrə unique)
          let cat = await tx.xerc_kateqoriyalari.findFirst({
            where: { sahibkar_id: sahibkarId, ad: catName },
            select: { id: true },
          }).catch(() => null);
          if (!cat) {
            cat = await tx.xerc_kateqoriyalari.create({
              data: {
                sahibkar_id: sahibkarId,
                ad: catName,
                qrup: "anbar_zerer",
              },
              select: { id: true },
            }).catch(() => null);
          }
          if (cat) {
            const tesvir = `Sayım zərəri (${inv.nomre})`;
            await tx.xercl_r.create({
              data: {
                sahibkar_id: sahibkarId,
                kateqoriya_id: cat.id,
                tarix: new Date(),
                mebleg: bucket.mebleg,
                tesvir,
                qeyd: bucket.details.slice(0, 5).join(", ") + (bucket.details.length > 5 ? "…" : ""),
                istifadeci_id: istifadeciId,
              },
            }).catch((e) => console.warn("[completeInventar] xerc skipped:", e));
          }
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
      let changedCount = 0;
      try {
        const inv = await prisma.inventarizasiyalar.findUnique({
          where: { id },
          include: { inventar_satirlari: { select: { mehsul_id: true, fakti_miqdar: true, sistemde_olan: true } } },
        });
        if (inv) {
          const changedIds = inv.inventar_satirlari
            .filter((r) => r.fakti_miqdar != null && Number(r.fakti_miqdar) !== Number(r.sistemde_olan))
            .map((r) => r.mehsul_id);
          changedCount = changedIds.length;
          const { emitStockChange } = await import("@/lib/stock-change-emitter");
          emitStockChange(changedIds);
        }
      } catch (e) {
        console.error("[completeInventar.emitStockChange]", e);
      }

      await audit("tesdiq", "inventarizasiya", id, {
        yeni_data: { status: "tamamlandi", changed_count: changedCount },
        sebeb: "Sayım tamamlandı — stok faktiki dəyərlərə düzəldildi",
      });

      return { ok: true };
    } catch (e) {
      console.error("[completeInventar]", e);
      const raw = e instanceof Error ? e.message : "";
      if (/səbəb|sayım|status|tapılmadı|qaralama/i.test(raw)) {
        return { ok: false, error: raw };
      }
      return { ok: false, error: safeUserMessage(e, "Sayım tamamlanmadı") };
    }
  });
}

export async function cancelInventar(id: string): Promise<ActionResult> {
  const { requireAnbarActionPerm } = await import("../access-guard");
  const permCheck = await requireAnbarActionPerm(["inventar.idare", "stok.idare", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const inv = await prisma.inventarizasiyalar.findUnique({
        where: { id },
        select: { status: true, nomre: true },
      });
      if (!inv) return { ok: false, error: "Sayım tapılmadı" };
      if (inv.status === "tamamlandi") {
        return {
          ok: false,
          error: `${inv.nomre} artıq tamamlanıb — ləğv edilə bilməz.`,
          hint: "Tamamlanmış sayımı ləğv etmək üçün ona uyğun düzəliş sənədi yaradın.",
        };
      }
      if (inv.status === "legv") {
        return { ok: false, error: "Bu sayım artıq ləğv edilib" };
      }

      await prisma.inventarizasiyalar.update({
        where: { id },
        data: { status: "legv" },
      });
      await audit("legv", "inventarizasiya", id, {
        yeni_data: { status: "legv" },
        sebeb: "Sayım ləğv edildi",
      });
      revalidatePath("/anbar/inventar");
      revalidatePath(`/anbar/inventar/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[cancelInventar]", e);
      return { ok: false, error: safeUserMessage(e, "Sayım ləğv edilmədi") };
    }
  });
}
