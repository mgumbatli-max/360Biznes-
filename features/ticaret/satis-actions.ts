"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { checkAndCreateStockAlertBatch } from "@/features/anbar/alert-helpers";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { requireTicaretActionPerm, bustTicaretCache } from "./access-guard";

type ActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      blockers?: import("@/lib/blockers/types").Blocker[];
      hint?: string;
    };

const ALLOWED_STATUSES = ["yeni", "tesdiq", "gonderildi", "tamamlandi"] as const;
type SaleStatus = (typeof ALLOWED_STATUSES)[number];

/**
 * Record an additional payment against an existing sale (e.g. customer comes
 * back later to clear part of their tab). Creates a kassa_emeliyyatlari row,
 * bumps `odenilmis`, and decrements customer debt if the sale was on borc.
 */
export async function recordSalePayment(
  saleId: string,
  mebleg: number,
  odenis_nov: "negd" | "kart" | "kecirme",
  qeyd: string | null,
): Promise<ActionResult> {
  const permCheck = await requireTicaretActionPerm(["satis.odenis", "satis.idare", "kassa.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!(mebleg > 0)) return { ok: false, error: "Məbləğ 0-dan böyük olmalıdır" };
  if (!["negd", "kart", "kecirme"].includes(odenis_nov))
    return { ok: false, error: "Ödəniş üsulu yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.$transaction(async (tx) => {
        // 🔒 FOR UPDATE LOCK — paralel ödənişlərdə over-payment önlənir
        const lockedRows = await tx.$queryRaw<Array<{
          id: string; son_mebleg: number; odenilmis: number; status: string;
        }>>`
          SELECT id, son_mebleg::float, COALESCE(odenilmis, 0)::float AS odenilmis, status
          FROM satis_sifarisleri WHERE id = ${saleId}::uuid FOR UPDATE
        `;
        if (lockedRows.length === 0) throw new Error("Satış tapılmadı");
        if (lockedRows[0].status === "legv") throw new Error("Ləğv edilmiş satışa ödəniş əlavə oluna bilməz");

        const sale = await tx.satis_sifarisleri.findUnique({
          where: { id: saleId },
          select: {
            id: true,
            son_mebleg: true,
            odenilmis: true,
            kassa_id: true,
            musteri_id: true,
            status: true,
            odenis_nov: true,
          },
        });
        if (!sale) throw new Error("Satış tapılmadı");

        const son = Number(sale.son_mebleg ?? 0);
        const already = Number(sale.odenilmis ?? 0);
        const qaliq = son - already;
        if (mebleg > qaliq + 0.001)
          throw new Error(`Məbləğ qalıq borcdan çoxdur (qalıq: ${qaliq.toFixed(2)})`);

        // ÖNƏMLİ: NULL kassa olarsa default aktiv nağd kassa istifadə olunur.
        // Beləliklə müştəri ödədi, kassa yox kimi əməliyyat itməz.
        let resolvedKassaId = sale.kassa_id;
        if (!resolvedKassaId) {
          const defaultKassa = await tx.kassalar.findFirst({
            where: { sahibkar_id: sahibkarId, status: "acig" },
            orderBy: { yaradildi: "asc" },
            select: { id: true },
          });
          resolvedKassaId = defaultKassa?.id ?? null;
        }
        if (!resolvedKassaId) {
          throw new Error(
            "Aktiv kassa tapılmadı — ödənişi qəbul etmək üçün əvvəlcə kassa açın",
          );
        }
        await tx.kassa_emeliyyatlari.create({
          data: {
            sahibkar_id: sahibkarId,
            kassa_id: resolvedKassaId,
            emeliyyat_nov: "satis",
            odenis_nov,
            mebleg: new Prisma.Decimal(mebleg),
            ref_nov: "satis_odenis",
            ref_id: sale.id,
            istifadeci_id: istifadeciId,
            qeyd: qeyd ?? "Sonradan ödəniş",
          },
        });
        // Satışın kassa_id-i NULL idisə, yenilə — gələcək ödənişlər eyni kassaya
        if (!sale.kassa_id) {
          await tx.satis_sifarisleri.updateMany({
            where: { id: sale.id, kassa_id: null },
            data: { kassa_id: resolvedKassaId },
          });
        }

        await tx.satis_sifarisleri.update({
          where: { id: sale.id },
          data: {
            odenilmis: { increment: new Prisma.Decimal(mebleg) },
            yenilendi: new Date(),
            ...(already + mebleg >= son - 0.001 ? { status: "tamamlandi" } : {}),
          },
        });

        // Müştəri balansını source-of-truth-dan yenidən hesabla.
        // Manual increment/decrement DRIFT yaradır — bütün təsir burada
        // satis_sifarisleri-dan derive olunur.
        if (sale.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(sale.musteri_id, tx);
        }

        // finance_operations — sonradan ödəniş hesab balansına və maliyyə/kassa
        // hesabatına düşsün (audit #5: əvvəl yalnız kassa_emeliyyatlari yazılırdı,
        // account-balance bunu görmürdü). satis-yeni-actions pattern-i mirror edilir.
        try {
          let opType = await tx.finance_operation_types.findUnique({ where: { kod: "qaime" } }).catch(() => null);
          if (!opType) {
            opType = await tx.finance_operation_types.create({
              data: { kod: "qaime", ad: "Qaimə", qrup: "qaime", y_n: "daxil", link_satish: true },
            });
          }
          if (opType) {
            let opHesabId: string | null = null;
            if (resolvedKassaId) {
              const kassaRow = await tx.kassalar.findFirst({
                where: { id: resolvedKassaId, sahibkar_id: sahibkarId },
                select: { maliye_hesab_id: true },
              });
              opHesabId = kassaRow?.maliye_hesab_id ?? null;
            }
            if (!opHesabId) {
              const fallbackNov = odenis_nov === "kart" ? "kart" : odenis_nov === "kecirme" ? "bank" : "negd";
              const def = await tx.maliye_hesablari.findFirst({
                where: { sahibkar_id: sahibkarId, aktiv: true, nov: fallbackNov },
                orderBy: { yaradildi: "asc" },
                select: { id: true },
              });
              opHesabId = def?.id ?? null;
            }
            await tx.finance_operations.create({
              data: {
                sahibkar_id: sahibkarId,
                type_id: opType.id,
                type_kod: opType.kod,
                y_n: "daxil",
                tarix: new Date(),
                meblegh: new Prisma.Decimal(mebleg),
                valyuta: "AZN",
                mezenne: 1,
                azn_meblegh: new Prisma.Decimal(mebleg),
                hesab_id: opHesabId,
                kontragent_id: sale.musteri_id ?? null,
                satis_id: sale.id,
                qeyd: qeyd ?? `Satış sonradan ödəniş — ${odenis_nov}`,
                yaradan_id: istifadeciId,
              },
            });
            if (opHesabId) {
              const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
              await recalculateAccountBalance(opHesabId, tx);
            }
          }
        } catch (e) {
          console.warn("[recordSalePayment] finance_operations skipped:", e);
        }
      });

      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "odenis",
        resurs_nov: "satis_sifarisi",
        resurs_id: saleId,
        yeni_data: { mebleg, odenis_nov, qeyd },
        status: "ugur",
      });

      revalidatePath(`/ticaret/satislar/${saleId}`);
      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret/kredit");
      bustTicaretCache();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

/**
 * Change the status of a sale through its workflow: yeni -> tesdiq -> gonderildi
 * -> tamamlandi. Does NOT allow going back to a prior step (use cancelSale for legv).
 */
export async function changeSaleStatus(saleId: string, status: SaleStatus): Promise<ActionResult> {
  const permCheck = await requireTicaretActionPerm(["satis.idare", "satis.status"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!ALLOWED_STATUSES.includes(status))
    return { ok: false, error: "Status yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const sale = await prisma.satis_sifarisleri.findUnique({
        where: { id: saleId },
        select: { id: true, status: true, nomre: true },
      });
      if (!sale) return { ok: false, error: "Satış tapılmadı" };
      if (sale.status === "legv") return { ok: false, error: "Ləğv edilmiş satış" };
      if (sale.status === status) return { ok: true };

      await prisma.satis_sifarisleri.update({
        where: { id: saleId },
        data: { status, yenilendi: new Date() },
      });

      // Audit log — outbox-safe (status keçidini izlə)
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "yenile",
        resurs_nov: "satis_sifarisi",
        resurs_id: saleId,
        evvelki_data: { status: sale.status },
        yeni_data: { status, nomre: sale.nomre },
        status: "ugur",
      });

      revalidatePath(`/ticaret/satislar/${saleId}`);
      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret/pipeline");
      bustTicaretCache();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

/**
 * Cancel a sale: restore stock, reverse cash register operation, reverse
 * customer debt. Only allowed for sales in status 'tamamlandi' or 'yeni'.
 */
export async function cancelSale(saleId: string, reason: string): Promise<ActionResult> {
  const permCheck = await requireTicaretActionPerm(["satis.legv", "satis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!reason.trim()) return { ok: false, error: "Səbəb göstərilməlidir" };
  if (reason.length > 1000) return { ok: false, error: "Səbəb çox uzundur" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const restoredMehsulIds: string[] = [];
    try {
      await prisma.$transaction(async (tx) => {
        const sale = await tx.satis_sifarisleri.findUnique({
          where: { id: saleId },
          include: { satis_sifaris_satirlari: true },
        });
        if (!sale) throw new Error("Satış tapılmadı");
        if (sale.status === "legv") throw new Error("Bu satış artıq ləğv edilib");

        const odenilmis = Number(sale.odenilmis ?? 0);

        // 🛑 Ödəniş və ya digər bağlı sənədlər varsa — STRUKTURLU blocker cavabı.
        // Throw etmirik: birbaşa qaytarırıq ki UI klik edilə bilən link göstərsin.
        if (odenilmis > 0.001) {
          const { findSaleBlockers } = await import("@/lib/blockers/find-sale-blockers");
          const blockers = await findSaleBlockers(saleId, tx);

          const sebebLower = reason.toLowerCase();
          const acknowledged =
            sebebLower.includes("ödəniş") ||
            sebebLower.includes("odenis") ||
            sebebLower.includes("refund") ||
            sebebLower.includes("geri qayt") ||
            sebebLower.includes("avans");
          if (!acknowledged && blockers.length > 0) {
            // İstisna ilə deyil — strukturlu obyekti tutulan blok-da geri qaytarırıq.
            const err = new Error("__BLOCKED__") as Error & { blockers?: typeof blockers; odenilmis?: number };
            err.blockers = blockers;
            err.odenilmis = odenilmis;
            throw err;
          }
        }

        // 1. Restore stock + reverse warehouse movement
        // QA-K12: stok yalnız HƏQİQƏTƏN azalıbsa bərpa olunur. Qaralama /
        // tesdiq_gozleyir satışlarında mexaric heç vaxt baş vermir — onların
        // ləğvi fantom stok mədaxili yaratmamalıdır. Etibarlı yoxlama:
        // orijinal mexaric anbar_hereketi mövcuddurmu (hər iki satış yolu —
        // POS və B2B — ref_nov='satis_sifarisi' yazır).
        // QA-K17: bərpa orijinal mexaric hərəkətlərinə əsaslanır — çox-anbarlı
        // satışda hər sətir ÖZ anbarına qayıdır (əvvəl hamısı sale.anbar_id-ə
        // yazılırdı). Hərəkət yoxdursa (qaralama/tesdiq_gozleyir) bərpa da yoxdur.
        const outMoves = await tx.anbar_hereketleri.findMany({
          where: {
            sahibkar_id: sahibkarId,
            ref_nov: "satis_sifarisi",
            ref_id: sale.id,
            nov: "mexaric",
          },
          select: { mehsul_id: true, anbar_id: true, miqdar: true, qiymet: true },
        });
        for (const mv of outMoves) {
          if (!mv.mehsul_id || !mv.anbar_id) continue;
          restoredMehsulIds.push(mv.mehsul_id);
          await tx.stok.updateMany({
            where: { sahibkar_id: sahibkarId, mehsul_id: mv.mehsul_id, anbar_id: mv.anbar_id },
            data: { miqdar: { increment: Number(mv.miqdar) } },
          });
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: mv.anbar_id,
              mehsul_id: mv.mehsul_id,
              nov: "medaxil",
              miqdar: Number(mv.miqdar),
              qiymet: Number(mv.qiymet ?? 0),
              ref_nov: "satis_legv",
              ref_id: sale.id,
              edilen_id: istifadeciId,
              qeyd: `Satış ləğv: ${reason}`,
            },
          });
        }

        // 2. Reverse cash if it was a paid sale
        // QA-K32: yalnız REAL daxil olmuş pul (odenilmis) geri çıxır —
        // hissəvi ödənilmiş satışda -sonMebleg yazmaq kassanı artıq azaldırdı.
        if (sale.odenis_nov !== "borc" && sale.kassa_id && odenilmis > 0.001) {
          await tx.kassa_emeliyyatlari.create({
            data: {
              sahibkar_id: sahibkarId,
              kassa_id: sale.kassa_id,
              emeliyyat_nov: "qaytarma",
              odenis_nov: sale.odenis_nov ?? "negd",
              mebleg: new Prisma.Decimal(-odenilmis),
              ref_nov: "satis_legv",
              ref_id: sale.id,
              istifadeci_id: istifadeciId,
              qeyd: reason,
            },
          });
        }

        // 3. Mark sale as cancelled — STANDART soft-delete sahələri də yazılır
        await tx.satis_sifarisleri.update({
          where: { id: sale.id },
          data: {
            status: "legv",
            qeyd: `Ləğv səbəbi: ${reason}\n${sale.qeyd ?? ""}`.trim(),
            // SOFT-DELETE STANDART
            deleted_at: new Date(),
            deleted_by: istifadeciId,
            delete_reason: reason,
          },
        });

        // 4. Müştəri balansını yenidən hesabla (status=legv olduğu üçün
        // bu satış artıq aktiv borc sayılmır → alacaq avtomatik azalır).
        if (sale.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(sale.musteri_id, tx);
        }

        // 4b. Bağlı maliye əməliyyatlarını ləğv et — hesab/bank balansı
        //     source-of-truth-dan avtomatik düzələcək (audit #4: əvvəl satışın
        //     finance_operations sətri ləğv olunmurdu, balans o mədaxili saxlayırdı).
        const saleFinOps = await tx.finance_operations.findMany({
          where: { sahibkar_id: sahibkarId, satis_id: sale.id, status: "aktiv" },
          select: { id: true, hesab_id: true },
        });
        const touchedHesabIds = new Set<string>();
        for (const op of saleFinOps) {
          if (op.hesab_id) touchedHesabIds.add(op.hesab_id);
          await tx.finance_operations.update({
            where: { id: op.id },
            data: { status: "legv", qeyd: `Satış ləğv: ${reason}` },
          });
        }
        if (touchedHesabIds.size > 0) {
          const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
          for (const hid of touchedHesabIds) {
            await recalculateAccountBalance(hid, tx);
          }
        }
      });

      // Auto-clear stock alerts if stock back to safe levels
      if (restoredMehsulIds.length > 0) {
        await checkAndCreateStockAlertBatch(restoredMehsulIds);
      }

      // 🔒 Kritik audit — satış ləğvi
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "legv",
        resurs_nov: "satis_sifarisi",
        resurs_id: saleId,
        yeni_data: { sebeb: reason, restored_count: restoredMehsulIds.length },
        status: "ugur",
      });

      revalidatePath("/ticaret/satislar");
      revalidatePath("/dashboard");
      revalidatePath("/maliyye");
      revalidatePath("/anbar");
      revalidatePath("/xeberdarliqlar");
      bustTicaretCache();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta";
      console.error("[cancelSale]", e);

      // 🛑 STRUKTURLU BLOCKER cavabı — UI klik edilə bilən link göstərir.
      if (e instanceof Error && e.message === "__BLOCKED__") {
        const err = e as Error & { blockers?: import("@/lib/blockers/types").Blocker[]; odenilmis?: number };
        const odenilmis = err.odenilmis ?? 0;
        try {
          await safeAuditLog({
            sahibkar_id: sahibkarId,
            istifadeci_id: istifadeciId,
            emeliyyat: "legv",
            resurs_nov: "satis_sifarisi",
            resurs_id: saleId,
            yeni_data: { sebeb: reason, blocked: true, blockers_count: err.blockers?.length ?? 0 },
            status: "xeta",
          });
        } catch {/* non-fatal */}
        return {
          ok: false,
          error: `Bu satışa ${odenilmis.toFixed(2)} ₼ ödəniş bağlanıb. Aşağıdakı sənədləri yoxlayın və ya səbəbdə "ödəniş geri qaytarıldı" qeyd edin.`,
          blockers: err.blockers ?? [],
          hint: "Sənədə klik edib oradan sil və ya səbəbdə geri ödənişi qeyd et.",
        } as ActionResult;
      }

      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "legv",
          resurs_nov: "satis_sifarisi",
          resurs_id: saleId,
          yeni_data: { sebeb: reason, error: msg },
          status: "xeta",
        });
      } catch {/* non-fatal */}
      return { ok: false, error: msg };
    }
  });
}

/**
 * Replace the internal note on a sale. Note is plain text shown on the
 * sale detail page (and printed receipt). Returns the saved value so the
 * client can confirm visually.
 */
export async function updateSaleNote(
  saleId: string,
  qeyd: string,
): Promise<{ ok: true; data: { qeyd: string } } | { ok: false; error: string }> {
  const permCheck = await requireTicaretActionPerm(["satis.idare", "satis.yenile"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const trimmed = qeyd.trim().slice(0, 4000);
      // 🔒 Açıq sahibkar_id qoruması — updateMany ilə tenant-scoped update
      const r = await prisma.satis_sifarisleri.updateMany({
        where: { id: saleId, sahibkar_id: sahibkarId },
        data: { qeyd: trimmed || null, yenilendi: new Date() },
      });
      if (r.count === 0) return { ok: false, error: "Satış tapılmadı" };
      revalidatePath(`/ticaret/satislar/${saleId}`);
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "yenile",
          resurs_nov: "satis_sifarisi",
          resurs_id: saleId,
          yeni_data: { qeyd_uzunluq: trimmed.length },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true, data: { qeyd: trimmed } };
    } catch (e) {
      console.error("[updateSaleNote]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

/**
 * Create a follow-up task linked to a sale. The link is stored via
 * `tapshiriq_obyektleri` (obyekt_nov="satis", obyekt_id=saleId) so the
 * tapshiriqlar table itself doesn't need a foreign column. Returned task
 * id can be used to jump to the task module.
 */
export async function createTaskForSale(
  saleId: string,
  basliq: string,
  deadline: string | null,
  prioritet: "asagi" | "normal" | "yuksek" | "tecili",
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const permCheck = await requireTicaretActionPerm(["tapshiriq.yarat", "satis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const title = basliq.trim();
  if (title.length < 3) return { ok: false, error: "Başlıq ən az 3 simvol olmalıdır" };
  if (!["asagi", "normal", "yuksek", "tecili"].includes(prioritet))
    return { ok: false, error: "Prioritet yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const sale = await prisma.satis_sifarisleri.findUnique({
        where: { id: saleId },
        select: { nomre: true },
      });
      if (!sale) return { ok: false, error: "Satış tapılmadı" };

      const deadlineDate = deadline ? new Date(deadline) : null;
      const task = await prisma.tapshiriqlar.create({
        data: {
          sahibkar_id: sahibkarId,
          basliq: title,
          tesvir: `Satışla bağlı: ${sale.nomre}`,
          prioritet,
          status: "yeni",
          deadline: deadlineDate,
          yaradan_id: istifadeciId,
          mesul_id: istifadeciId,
        },
        select: { id: true },
      });
      await prisma.tapshiriq_obyektleri.create({
        data: {
          sahibkar_id: sahibkarId,
          tapshiriq_id: task.id,
          obyekt_nov: "satis",
          obyekt_id: saleId,
          obyekt_basliq: sale.nomre,
        },
      });
      revalidatePath(`/ticaret/satislar/${saleId}`);
      revalidatePath("/tapshiriqlar");
      return { ok: true, data: { id: task.id } };
    } catch (e) {
      console.error("[createTaskForSale]", e);
      return { ok: false, error: "Tapşırıq yaradılmadı" };
    }
  });
}

/**
 * Bulk change of sale status for a set of sales (e.g. mass-mark several
 * orders as "tesdiq" or "tamamlandi"). Skips sales already in target
 * status or in `legv`. Returns count of updated rows.
 */
export async function bulkChangeSaleStatus(
  ids: string[],
  status: SaleStatus,
): Promise<{ ok: true; data: { count: number } } | { ok: false; error: string }> {
  const permCheck = await requireTicaretActionPerm(["satis.idare", "satis.status"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!ids.length) return { ok: false, error: "Heç bir satış seçilməyib" };
  if (ids.length > 1000) return { ok: false, error: "Bir dəfəyə 1000-dən çox satış olmamalıdır" };
  if (!ALLOWED_STATUSES.includes(status)) return { ok: false, error: "Status yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 🔒 Cross-tenant qoruması — açıq sahibkar_id filtri
      const r = await prisma.satis_sifarisleri.updateMany({
        where: { sahibkar_id: sahibkarId, id: { in: ids }, status: { not: "legv" } },
        data: { status, yenilendi: new Date() },
      });
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "bulk_yenile",
        resurs_nov: "satis_sifarisi",
        resurs_id: null,
        yeni_data: { status, requested_count: ids.length, updated_count: r.count },
        status: "ugur",
      });
      revalidatePath("/ticaret/satislar");
      bustTicaretCache();
      return { ok: true, data: { count: r.count } };
    } catch (e) {
      console.error("[bulkChangeSaleStatus]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

/**
 * Get linked tasks for a sale via `tapshiriq_obyektleri`. Used by the
 * sale detail page to display the task list inline.
 */
export async function getLinkedTasksForSale(saleId: string) {
  return withTenant(async () => {
    const links = await prisma.tapshiriq_obyektleri.findMany({
      where: { obyekt_nov: "satis", obyekt_id: saleId },
      orderBy: { yaradildi: "desc" },
      select: {
        tapshiriq_id: true,
        tapshiriqlar: {
          select: {
            id: true,
            basliq: true,
            status: true,
            prioritet: true,
            deadline: true,
            yaradildi: true,
          },
        },
      },
    });
    return links
      .map((l) => l.tapshiriqlar)
      .filter((t): t is NonNullable<typeof t> => t !== null);
  });
}
