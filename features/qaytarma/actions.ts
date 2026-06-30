"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { createApprovalRequest, shouldApproveRefund } from "@/features/tesdiq/create";
import { audit } from "@/lib/audit/log";
import { safeStockDecrement } from "@/lib/db/stock-guards";
import { nextDocNumber } from "@/lib/db/sened-nomre";
// QA-orta: raw Prisma/DB mesajı UI toast-una sızmasın — mərkəzi sanitizer
import { logAndFriendly } from "@/lib/error/user-message";
import { requireTicaretActionPerm } from "@/features/ticaret/access-guard";

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
  // QA-K: orijinal satış/alış sənədinə bağlama — verilibsə acceptReturn
  // qəbul zamanı sənədin son_mebleg/umumi_mebleg-ini korreksiya edir.
  // Verilməyəndə (sərbəst manual qaytarma) köhnə davranış qalır.
  original_id: z.string().uuid().nullable().optional(),
  sebeb: z.string().trim().min(3, "Səbəb tələb olunur"),
  qeyd: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(LineSchema).min(1, "Ən az 1 sətir olmalıdır"),
});

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

  const permCheck = await requireTicaretActionPerm("qaytarma.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const umumi = data.lines.reduce((s, l) => s + l.miqdar * l.vahid_qiymet, 0);

      // QA-K (race): nomre atomik counter ilə yaradılır — paralel/double-submit
      // eyni Q-YYMMDD-NNNN-i almağa cəhd etmir (nextReturnNumber findFirst+1 idi).
      const created = await prisma.$transaction(async (tx) => {
        const nomre = await nextDocNumber(tx, sahibkarId, "qaytarma");
        return tx.qaytarma_sifarisleri.create({
          data: {
            nomre,
            nov: data.nov === "musteri" ? "satis_qaytarma" : "alis_qaytarma",
            anbar_id: data.anbar_id,
            kontragent_id: data.kontragent_id,
            original_id: data.original_id ?? null,
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
      // QA-orta: raw DB mesajı əvəzinə təmiz istifadəçi mesajı
      return { ok: false, error: logAndFriendly("createReturn", e, "Qaytarma yaradılmadı") };
    }
  });
}

/**
 * Accept a pending return: applies stock movement and marks status as
 * `tamamlandi`. For customer returns (satis_qaytarma), stock is incremented;
 * for supplier returns (alis_qaytarma) stock is decremented.
 */
export async function acceptReturn(returnId: string): Promise<ActionResult> {
  const permCheck = await requireTicaretActionPerm("qaytarma.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.$transaction(async (tx) => {
        // QA-orta: FOR UPDATE lock — paralel qəbul (double-click / iki tab)
        // hər ikisi "tesdiqlenmemis" oxuyub stoku İKİQAT artıra bilirdi;
        // sibling pattern: satis-actions.ts recordSalePayment
        await tx.$queryRaw`
          SELECT id FROM qaytarma_sifarisleri WHERE id = ${returnId}::uuid FOR UPDATE
        `;
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

        // 🔄 Müştəri qaytarması → orijinal satışın son_mebleg + balansını korreksiya et.
        // Qismən qaytarmada satışın `son_mebleg` (faktiki məbləğ) azalır.
        // Tam qaytarmada satış statusu `qaytarilib` olur — source-of-truth onu görmür.
        if (ret.nov === "satis_qaytarma" && ret.original_id) {
          const original = await tx.satis_sifarisleri.findUnique({
            where: { id: ret.original_id },
            select: {
              id: true,
              nomre: true,
              son_mebleg: true,
              odenilmis: true,
              musteri_id: true,
              odenis_nov: true,
              kassa_id: true,
            },
          });
          if (original) {
            const refundTotal = Number(ret.umumi_mebleg ?? 0);
            const yeniSonMebleg = Math.max(0, Number(original.son_mebleg ?? 0) - refundTotal);
            const odenilmis = Number(original.odenilmis ?? 0);
            // Status: tam qaytarmadasa "qaytarilib", qismən qaytarmada əvvəlki status qalır
            const tamGeri = yeniSonMebleg < 0.01;
            await tx.satis_sifarisleri.update({
              where: { id: original.id },
              data: {
                son_mebleg: yeniSonMebleg,
                // Əgər müştəri artıq qaytarılan məbləğdən çoxunu ödəyibsə —
                // odenilmis-i kəs (geri qayıdır kassaya, ayrıca kassa əməliyyatı).
                odenilmis: Math.min(odenilmis, yeniSonMebleg),
                ...(tamGeri ? { status: "qaytarilib" } : {}),
              },
            });

            // QA-K (kassa refund): nəğd/kart satışın qaytarılmasında kassadan pul
            // çıxışı — fastReturn/returnFullSale-da var idi, acceptReturn-da YOX idi.
            // Yalnız real daxil olmuş pul qədər geri çıx (hissəvi ödəniş müdafiəsi).
            const isNisye = original.odenis_nov === "nisye" || original.odenis_nov === "borc";
            if (!isNisye && original.kassa_id) {
              const refund = Math.min(refundTotal, odenilmis > 0 ? odenilmis : refundTotal);
              if (refund > 0.001) {
                await tx.kassa_emeliyyatlari.create({
                  data: {
                    sahibkar_id: sahibkarId,
                    kassa_id: original.kassa_id,
                    emeliyyat_nov: "qaytarma",
                    odenis_nov: original.odenis_nov ?? "negd",
                    mebleg: new Prisma.Decimal(-refund),
                    ref_nov: "qaytarma_qebul",
                    ref_id: ret.id,
                    istifadeci_id: istifadeciId,
                    qeyd: `Qaytarma refund: ${ret.nomre} (satis #${original.nomre})`,
                  },
                });
                // 🚨 Reversing finance_operations — hesab balansı şişməsin (kritik).
                const { recordRefundFinanceOp } = await import("@/features/ticaret/refund-finance");
                await recordRefundFinanceOp(tx, {
                  sahibkarId, saleId: original.id, musteriId: original.musteri_id,
                  kassaId: original.kassa_id, odenisNov: original.odenis_nov, refund,
                  istifadeciId, qeyd: `Qaytarma refund: ${ret.nomre} (satis #${original.nomre})`,
                });
              }
            }

            // Müştəri balansını source-of-truth ilə yenilə
            if (original.musteri_id) {
              const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
              await recalculateCustomerBalance(original.musteri_id, tx);
            }
          }
        }

        // Təchizatçı qaytarması → orijinal alışda eyni korreksiya
        if (ret.nov === "alis_qaytarma" && ret.original_id) {
          const original = await tx.alis_sifarisleri.findUnique({
            where: { id: ret.original_id },
            select: { id: true, umumi_mebleg: true, odenilmis: true, techiazatci_id: true },
          });
          if (original) {
            const yeniUmumi = Math.max(0, Number(original.umumi_mebleg ?? 0) - Number(ret.umumi_mebleg ?? 0));
            const odenilmis = Number(original.odenilmis ?? 0);
            await tx.alis_sifarisleri.update({
              where: { id: original.id },
              data: {
                umumi_mebleg: yeniUmumi,
                odenilmis: Math.min(odenilmis, yeniUmumi),
              },
            });
            if (original.techiazatci_id) {
              const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
              await recalculateSupplierBalance(original.techiazatci_id, tx);
            }
          }
        }
      });

      revalidatePath("/ticaret/qaytarma");
      revalidatePath("/ticaret/emeliyyat");
      await audit("tesdiq", "qaytarma_sifarisi", returnId, {
        yeni_data: { status: "tamamlandi" },
        sebeb: "Qaytarma təsdiqləndi və stoka tətbiq olundu",
      });
      return { ok: true };
    } catch (e) {
      // QA-orta: raw DB mesajı əvəzinə təmiz istifadəçi mesajı
      return { ok: false, error: logAndFriendly("acceptReturn", e, "Qaytarma qəbul edilmədi") };
    }
  });
}

/**
 * Cancel a pending return (status -> legv). Does not affect stock since the
 * return was never accepted in the first place.
 */
export async function cancelReturn(returnId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { ok: false, error: "Səbəb tələb olunur" };
  const permCheck = await requireTicaretActionPerm("qaytarma.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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
      // QA-orta: raw DB mesajı əvəzinə təmiz istifadəçi mesajı
      return { ok: false, error: logAndFriendly("cancelReturn", e, "Qaytarma ləğvi alınmadı") };
    }
  });
}
