"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { checkAndCreateStockAlertBatch } from "@/features/anbar/alert-helpers";

type ActionResult = { ok: true } | { ok: false; error: string };

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
  if (!(mebleg > 0)) return { ok: false, error: "Məbləğ 0-dan böyük olmalıdır" };
  if (!["negd", "kart", "kecirme"].includes(odenis_nov))
    return { ok: false, error: "Ödəniş üsulu yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.$transaction(async (tx) => {
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
        if (sale.status === "legv") throw new Error("Ləğv edilmiş satışa ödəniş əlavə oluna bilməz");

        const son = Number(sale.son_mebleg ?? 0);
        const already = Number(sale.odenilmis ?? 0);
        const qaliq = son - already;
        if (mebleg > qaliq + 0.01)
          throw new Error(`Məbləğ qalıq borcdan çoxdur (qalıq: ${qaliq.toFixed(2)})`);

        if (sale.kassa_id) {
          await tx.kassa_emeliyyatlari.create({
            data: {
              sahibkar_id: sahibkarId,
              kassa_id: sale.kassa_id,
              emeliyyat_nov: "satis",
              odenis_nov,
              mebleg: new Prisma.Decimal(mebleg),
              ref_nov: "satis_odenis",
              ref_id: sale.id,
              istifadeci_id: istifadeciId,
              qeyd: qeyd ?? "Sonradan ödəniş",
            },
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

        if (sale.odenis_nov === "borc" && sale.musteri_id) {
          await tx.kontragentler.update({
            where: { id: sale.musteri_id },
            data: { borc: { decrement: new Prisma.Decimal(mebleg) } },
          });
        }
      });

      revalidatePath(`/ticaret/satislar/${saleId}`);
      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret/kredit");
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

      // Audit log — pipeline-da edilən status keçidini izlə
      try {
        await prisma.audit_log.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: istifadeciId,
            emeliyyat: "yenile",
            resurs_nov: "satis_sifarisi",
            resurs_id: saleId,
            evvelki_data: { status: sale.status },
            yeni_data: { status, nomre: sale.nomre },
            status: "ugur",
          },
        });
      } catch (e) {
        console.warn("[changeSaleStatus] audit_log skipped:", e);
      }

      revalidatePath(`/ticaret/satislar/${saleId}`);
      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret/pipeline");
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
  if (!reason.trim()) return { ok: false, error: "Səbəb göstərilməlidir" };

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

        const sonMebleg = Number(sale.son_mebleg ?? 0);

        // 1. Restore stock + reverse warehouse movement
        for (const line of sale.satis_sifaris_satirlari) {
          if (!line.mehsul_id || !sale.anbar_id) continue;
          restoredMehsulIds.push(line.mehsul_id);
          await tx.stok.updateMany({
            where: { sahibkar_id: sahibkarId, mehsul_id: line.mehsul_id, anbar_id: sale.anbar_id },
            data: { miqdar: { increment: Number(line.miqdar) } },
          });
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: sale.anbar_id,
              mehsul_id: line.mehsul_id,
              nov: "medaxil",
              miqdar: Number(line.miqdar),
              qiymet: Number(line.vahid_qiymet),
              ref_nov: "satis_legv",
              ref_id: sale.id,
              edilen_id: istifadeciId,
              qeyd: `Satış ləğv: ${reason}`,
            },
          });
        }

        // 2. Reverse cash if it was a paid sale
        if (sale.odenis_nov !== "borc" && sale.kassa_id) {
          await tx.kassa_emeliyyatlari.create({
            data: {
              sahibkar_id: sahibkarId,
              kassa_id: sale.kassa_id,
              emeliyyat_nov: "qaytarma",
              odenis_nov: sale.odenis_nov ?? "negd",
              mebleg: new Prisma.Decimal(-sonMebleg),
              ref_nov: "satis_legv",
              ref_id: sale.id,
              istifadeci_id: istifadeciId,
              qeyd: reason,
            },
          });
        }

        // 3. Reverse customer debt if it was a credit sale
        if (sale.odenis_nov === "borc" && sale.musteri_id) {
          await tx.kontragentler.update({
            where: { id: sale.musteri_id },
            data: { borc: { decrement: sonMebleg } },
          });
        }

        // 4. Mark sale as cancelled
        await tx.satis_sifarisleri.update({
          where: { id: sale.id },
          data: { status: "legv", qeyd: `Ləğv səbəbi: ${reason}\n${sale.qeyd ?? ""}`.trim() },
        });
      });

      // Auto-clear stock alerts if stock back to safe levels
      if (restoredMehsulIds.length > 0) {
        await checkAndCreateStockAlertBatch(restoredMehsulIds);
      }

      revalidatePath("/ticaret/satislar");
      revalidatePath("/dashboard");
      revalidatePath("/anbar");
      revalidatePath("/xeberdarliqlar");
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta";
      console.error("[cancelSale]", e);
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
  return withTenant(async () => {
    try {
      const trimmed = qeyd.trim().slice(0, 4000);
      const updated = await prisma.satis_sifarisleri.update({
        where: { id: saleId },
        data: { qeyd: trimmed || null, yenilendi: new Date() },
        select: { qeyd: true },
      });
      revalidatePath(`/ticaret/satislar/${saleId}`);
      return { ok: true, data: { qeyd: updated.qeyd ?? "" } };
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
  if (!ids.length) return { ok: false, error: "Heç bir satış seçilməyib" };
  if (!ALLOWED_STATUSES.includes(status)) return { ok: false, error: "Status yanlışdır" };

  return withTenant(async () => {
    try {
      const r = await prisma.satis_sifarisleri.updateMany({
        where: { id: { in: ids }, status: { not: "legv" } },
        data: { status, yenilendi: new Date() },
      });
      revalidatePath("/ticaret/satislar");
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
