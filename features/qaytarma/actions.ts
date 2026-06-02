"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { createApprovalRequest, shouldApproveRefund } from "@/features/tesdiq/create";
import { audit } from "@/lib/audit/log";
import { safeStockDecrement } from "@/lib/db/stock-guards";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const LineSchema = z.object({
  mehsul_id: z.string().uuid(),
  miqdar: z.coerce.number().positive(),
  vahid_qiymet: z.coerce.number().nonnegative(),
});

const CreateReturnSchema = z.object({
  nov: z.enum(["musteri", "techizatci"]),
  anbar_id: z.coerce.number().int().positive(),
  kontragent_id: z.string().uuid().nullable(),
  sebeb: z.string().trim().min(3, "Səbəb tələb olunur"),
  qeyd: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(LineSchema).min(1, "Ən az 1 sətir olmalıdır"),
});

async function nextReturnNumber(): Promise<string> {
  // Pattern: Q-YYMMDD-NNNN
  const now = new Date();
  const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const prefix = `Q-${ymd}-`;
  const last = await prisma.qaytarma_sifarisleri.findFirst({
    where: { nomre: { startsWith: prefix } },
    orderBy: { nomre: "desc" },
    select: { nomre: true },
  });
  const seq = last ? Number(last.nomre.split("-").pop() ?? "0") + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Create a return order. Stock movement is applied only when the return is
 * accepted via `acceptReturn` — at creation it stays in `tesdiqlenmemis`.
 */
export async function createReturn(
  raw: z.infer<typeof CreateReturnSchema>,
): Promise<ActionResult<{ id: string; nomre: string }>> {
  const parsed = CreateReturnSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const data = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const nomre = await nextReturnNumber();
      const umumi = data.lines.reduce((s, l) => s + l.miqdar * l.vahid_qiymet, 0);

      const created = await prisma.qaytarma_sifarisleri.create({
        data: {
          nomre,
          nov: data.nov === "musteri" ? "satis_qaytarma" : "alis_qaytarma",
          anbar_id: data.anbar_id,
          kontragent_id: data.kontragent_id,
          sebeb: data.sebeb,
          qeyd: data.qeyd ?? null,
          umumi_mebleg: new Prisma.Decimal(Math.round(umumi * 100) / 100),
          status: "tesdiqlenmemis",
          yaradan_id: istifadeciId,
          sahibkar_id: sahibkarId,
          qaytarma_satirlari: {
            create: data.lines.map((l) => ({
              mehsul_id: l.mehsul_id,
              miqdar: new Prisma.Decimal(l.miqdar),
              vahid_qiymet: new Prisma.Decimal(l.vahid_qiymet),
              sahibkar_id: sahibkarId,
            })),
          },
        },
        select: { id: true, nomre: true },
      });

      // Təsdiq tələbi — qaytarma kind, mövcud threshold helper-i istifadə et
      const { needed, limit } = await shouldApproveRefund(umumi);
      if (needed) {
        await createApprovalRequest({
          emeliyyat_nov: "qaytarma",
          resurs_nov: "qaytarma_sifarisi",
          resurs_id: created.id,
          basliq: `Qaytarma ${created.nomre}`,
          risk_sebeb: limit > 0
            ? `Qaytarma məbləği ${umumi.toFixed(2)}₼ — limit ${limit}₼-i keçir`
            : "Hər qaytarma təsdiq tələb edir",
          mebleg: umumi,
          prioritet: umumi > 1000 ? "yuxsek" : "orta",
          detay_json: {
            nov: data.nov,
            anbar_id: data.anbar_id,
            kontragent_id: data.kontragent_id,
            line_count: data.lines.length,
          },
        });
        revalidatePath("/tesdiq");
      }

      revalidatePath("/ticaret/qaytarma");
      revalidatePath("/ticaret/emeliyyat");

      // Qaytarma stoku artırır (geri qəbul) — kanal-larına sync
      try {
        const { emitStockChange } = await import("@/lib/stock-change-emitter");
        emitStockChange(data.lines.map((l) => l.mehsul_id));
      } catch (e) {
        console.error("[createReturn.emitStockChange]", e);
      }

      await audit("yarat", "qaytarma_sifarisi", created.id, {
        yeni_data: {
          nomre: created.nomre,
          nov: data.nov,
          anbar_id: data.anbar_id,
          kontragent_id: data.kontragent_id,
          line_count: data.lines.length,
        },
        sebeb: data.sebeb,
      });

      return { ok: true, data: created };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

/**
 * Accept a pending return: applies stock movement and marks status as
 * `tamamlandi`. For customer returns (satis_qaytarma), stock is incremented;
 * for supplier returns (alis_qaytarma) stock is decremented.
 */
export async function acceptReturn(returnId: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.$transaction(async (tx) => {
        const ret = await tx.qaytarma_sifarisleri.findUnique({
          where: { id: returnId },
          include: { qaytarma_satirlari: true },
        });
        if (!ret) throw new Error("Qaytarma tapılmadı");
        if (ret.status !== "tesdiqlenmemis") {
          throw new Error("Yalnız təsdiq gözləyən qaytarma qəbul edilə bilər");
        }

        const isCustomerReturn = ret.nov === "satis_qaytarma";
        const movementNov = isCustomerReturn ? "medaxil" : "mexaric";

        for (const line of ret.qaytarma_satirlari) {
          // Customer return → stok artır (additive, race-safe).
          // Supplier return → stok azalt — safeStockDecrement ilə yoxlanılır
          // ki, mövcud stok kifayət etməsə əməliyyat throw etsin (mənfi stok
          // qarşısı alınır).
          const miqdar = Number(line.miqdar);
          if (isCustomerReturn) {
            await tx.stok.updateMany({
              where: { sahibkar_id: sahibkarId, mehsul_id: line.mehsul_id, anbar_id: ret.anbar_id },
              data: { miqdar: { increment: miqdar } },
            });
          } else {
            if (!ret.anbar_id) throw new Error("Qaytarmada anbar göstərilməyib");
            const dec = await safeStockDecrement(tx, {
              mehsulId: line.mehsul_id,
              anbarId: ret.anbar_id,
              miqdar,
            });
            if (!dec.ok) throw new Error(dec.error);
          }
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: ret.anbar_id,
              mehsul_id: line.mehsul_id,
              nov: movementNov,
              miqdar: Number(line.miqdar),
              qiymet: Number(line.vahid_qiymet),
              ref_nov: "qaytarma_qebul",
              ref_id: ret.id,
              edilen_id: istifadeciId,
              qeyd: `Qaytarma qəbul: ${ret.nomre}`,
            },
          });
        }

        await tx.qaytarma_sifarisleri.update({
          where: { id: ret.id },
          data: {
            status: "tamamlandi",
            geri_qaytarildi: ret.umumi_mebleg,
            yenilendi: new Date(),
          },
        });
      });

      revalidatePath("/ticaret/qaytarma");
      revalidatePath("/ticaret/emeliyyat");
      await audit("tesdiq", "qaytarma_sifarisi", returnId, {
        yeni_data: { status: "tamamlandi" },
        sebeb: "Qaytarma təsdiqləndi və stoka tətbiq olundu",
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

/**
 * Cancel a pending return (status -> legv). Does not affect stock since the
 * return was never accepted in the first place.
 */
export async function cancelReturn(returnId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { ok: false, error: "Səbəb tələb olunur" };
  return withTenant(async () => {
    try {
      const ret = await prisma.qaytarma_sifarisleri.findUnique({
        where: { id: returnId },
        select: { status: true, qeyd: true },
      });
      if (!ret) return { ok: false, error: "Qaytarma tapılmadı" };
      if (ret.status === "tamamlandi") {
        return { ok: false, error: "Tamamlanmış qaytarma ləğv edilə bilməz" };
      }
      await prisma.qaytarma_sifarisleri.update({
        where: { id: returnId },
        data: {
          status: "legv",
          qeyd: `${ret.qeyd ?? ""}\nLəğv: ${reason}`.trim(),
        },
      });
      await audit("legv", "qaytarma_sifarisi", returnId, {
        evvelki_data: { status: ret.status },
        yeni_data: { status: "legv" },
        sebeb: reason,
      });
      revalidatePath("/ticaret/qaytarma");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}
