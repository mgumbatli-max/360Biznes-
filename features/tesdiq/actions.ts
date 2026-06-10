"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { canApproveDocApproval, isFullDocApproval } from "./permissions";
import { audit } from "@/lib/audit/log";

type ActionResult = { ok: true } | { ok: false; error: string };
type BulkResult = { ok: true; affected: number } | { ok: false; error: string };

function bustTesdiqCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`nezaret:${sahibkarId}`, "max");
  } catch {
    // tenant yox — sessizcə keç
  }
}

async function logTransition(telepId: number, istifadeciId: string, evvelki: string | null, yeni: string, emeliyyat: string, qeyd?: string | null) {
  try {
    await prisma.tesdiq_log.create({
      data: {
        telep_id: telepId,
        istifadeci_id: istifadeciId,
        emeliyyat,
        evvelki_status: evvelki,
        yeni_status: yeni,
        qeyd: qeyd ?? null,
      },
    });
  } catch (e) {
    console.warn("[tesdiq] log skipped:", e);
  }
}

export async function approveRequest(id: number, note?: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const cur = await prisma.tesdiq_telep.findUnique({
        where: { id },
        select: { status: true, emeliyyat_nov: true, resurs_nov: true, resurs_id: true, yaradan_id: true },
      });
      // Per-kind icazə yoxlanışı: bu növü təsdiq etmək hüququ varmı?
      if (cur) {
        const allowed = await canApproveDocApproval(cur.emeliyyat_nov);
        if (!allowed) {
          return {
            ok: false,
            error: "Bu növü təsdiq etmək icazəniz yoxdur. Sahibkar başqa şəxs təyin edib.",
          };
        }
      }
      // 4-eyes prinsipi: yaradan eyni sənədi təsdiq edə bilməz
      if (cur?.yaradan_id === istifadeciId) {
        return {
          ok: false,
          error: "Öz yaratdığınız sorğunu təsdiq edə bilməzsiniz (4-eyes qaydası). Başqa təsdiq edən şəxsə müraciət edin.",
        };
      }
      await prisma.tesdiq_telep.update({
        where: { id },
        data: {
          status: "tesdiq",
          baxan_id: istifadeciId,
          netice_qeyd: note ?? null,
          netice_tarix: new Date(),
        },
      });
      await logTransition(id, istifadeciId, cur?.status ?? null, "tesdiq", "tesdiqlendi", note);
      await audit("tesdiq", "tesdiq_telep", id, {
        evvelki_data: { status: cur?.status ?? null },
        yeni_data: { status: "tesdiq", emeliyyat_nov: cur?.emeliyyat_nov, resurs_nov: cur?.resurs_nov, resurs_id: cur?.resurs_id },
        sebeb: note ?? undefined,
      });

      // 4-eyes (tam-sənəd) təsdiqi: təsdiq edildikdən sonra original sənədi
      // aktivləşdir. Hər sənəd növü öz status modelini var, ona görə switch.
      if (cur?.resurs_nov && cur?.resurs_id) {
        // detay_json-u da oxu — məhsul update halında dəyişiklikləri içində daşıyır
        const full = await prisma.tesdiq_telep.findUnique({
          where: { id },
          select: { detay_json: true },
        });
        await propagateDocumentApproval(cur.emeliyyat_nov, cur.resurs_nov, cur.resurs_id, full?.detay_json);
      }

      revalidatePath("/tesdiq");
      revalidatePath(`/tesdiq/${id}`);
      revalidatePath("/ticaret/alislar");
      bustTesdiqCache();
      return { ok: true };
    } catch (e) {
      console.error("[approveRequest]", e);
      return { ok: false, error: "Təsdiqlənmədi" };
    }
  });
}

/**
 * Təsdiq mərkəzində təsdiqdən sonra original sənədin (alış/satış/məhsul)
 * statusunu aktivə çevirir. Hər sənəd növünün öz status modelinə uyğun.
 */
async function propagateDocumentApproval(
  emeliyyatNov: string,
  resursNov: string,
  resursId: string,
  detayJson?: unknown,
): Promise<void> {
  try {
    if (emeliyyatNov === "alis_qaime" && resursNov === "alis_sifarisi") {
      const purchase = await prisma.alis_sifarisleri.findUnique({
        where: { id: resursId },
        include: { alis_sifaris_satirlari: { select: { mehsul_id: true, miqdar: true, vahid_qiymet: true } } },
      });
      if (!purchase || purchase.status !== "tesdiq_gozleyir") return;
      await prisma.alis_sifarisleri.update({
        where: { id: resursId },
        data: { status: "gozlemede" },
      });
      // Təchizatçı borcu source-of-truth recalc — manual increment YOX.
      // Status `gozlemede`-yə dəyişdiyi üçün calculateSupplierBalance avtomatik
      // bu alışı qalığa əlavə edəcək.
      if (purchase.techiazatci_id) {
        const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
        await recalculateSupplierBalance(purchase.techiazatci_id, prisma);
      }
      return;
    }
    if (emeliyyatNov === "satis_qaime" && resursNov === "satis_sifarisi") {
      const sale = await prisma.satis_sifarisleri.findUnique({
        where: { id: resursId },
        select: { status: true },
      });
      // QA-K16: təsdiqdən sonra satış REAL materiallaşır — stok mexarici,
      // kassa/finance, müştəri borcu (əvvəl yalnız status "yeni" olurdu və
      // heç bir təsir yaranmırdı: satış hesabatda görünür, stok azalmırdı).
      // İdempotentdir — mexaric artıq varsa təkrar etmir.
      if (sale?.status === "tesdiq_gozleyir") {
        const { materializeApprovedSale } = await import("@/features/ticaret/satis-materialize");
        const mat = await materializeApprovedSale(resursId);
        if (!mat.ok) {
          // Materiallaşma alınmadısa (məs. stok çatışmır) satışı tesdiq_gozleyir
          // saxlamaq əvəzinə statusu yeni-yə salıb xətanı log edirik — təsdiq
          // axını bloklanmasın, amma izi qalsın.
          console.error("[propagateDocumentApproval] materialize failed:", mat.error);
          await prisma.satis_sifarisleri.update({
            where: { id: resursId },
            data: { status: "yeni", xeber_qeydi: `Materiallaşma xətası: ${mat.error}` },
          });
        }
      }
      return;
    }
    if (emeliyyatNov === "ticaret_emeliyyat" && resursNov === "anbar_transferi") {
      // Transfer təsdiq edildikdə status dəyişməyə ehtiyac yoxdur — istifadəçi
      // "Qəbul et" düyməsi ilə həqiqi stok hərəkətini icra edir. Burada
      // yalnız "təsdiqlənib" işarəsi qoymaq olar; lakin schema-da belə bir
      // sahə yoxdur, ona görə heç nə etmirik. Audit log onsuz da var.
      return;
    }
    if (emeliyyatNov === "qaytarma" && resursNov === "qaytarma_sifarisi") {
      // Qaytarma da iki mərhələlidir. Təsdiqdən sonra status "tesdiqlenmemis"
      // qalır — istifadəçi acceptReturn ilə həqiqi stok dəyişikliyini etməlidir.
      return;
    }
    if (emeliyyatNov === "xerc" && resursNov === "xerc") {
      // Xərc qeydi cüz'i — artıq xercl_r-də mövcuddur. Təsdiq yalnız
      // audit/log məqsədilədir.
      return;
    }
    if (emeliyyatNov === "mehsul_yaratma" && resursNov === "mehsul") {
      // detay_json içində `tip: "create" | "update"` discriminatoru var:
      //  - create: sadəcə aktivləşdir (məhsul artıq tam fields ilə yaradılıb)
      //  - update: təklif olunan dəyişiklikləri after sahəsindən mehsullara tətbiq et
      const detay = detayJson as { tip?: "create" | "update"; after?: Record<string, unknown> } | null;
      if (detay?.tip === "update" && detay.after && typeof detay.after === "object") {
        await prisma.mehsullar.update({
          where: { id: resursId },
          data: detay.after as Record<string, never>,
        });
      } else {
        // "create" və ya köhnə qeyd: yalnız aktivləşdir
        await prisma.mehsullar.update({
          where: { id: resursId },
          data: { aktiv: true },
        });
      }
      return;
    }
    if (emeliyyatNov === "stok_duzelis" && resursNov === "stok") {
      // detay_json-dan stok düzəliş parametrlərini al və adjustStock-u
      // skipApprovalCheck:true ilə icra et (yenidən təsdiq tələbinə düşməsin)
      const detay = detayJson as {
        mehsul_id?: string;
        anbar_id?: number;
        nov?: "medaxil" | "mexaric" | "inventar";
        miqdar?: number;
        qiymet?: number;
        sebeb?: string;
      } | null;
      if (detay?.mehsul_id && detay.anbar_id && detay.nov && detay.miqdar) {
        const { adjustStock } = await import("@/features/anbar/stock-actions");
        const r = await adjustStock(
          {
            mehsul_id: detay.mehsul_id,
            anbar_id: detay.anbar_id,
            nov: detay.nov,
            miqdar: detay.miqdar,
            qiymet: detay.qiymet ?? 0,
            sebeb: `[TƏSDİQLƏNDİ] ${detay.sebeb ?? "Böyük stok düzəlişi"}`,
          },
          { skipApprovalCheck: true },
        );
        if (!r.ok) {
          console.warn("[propagateDocumentApproval] stok_duzelis adjustStock failed:", r.error);
        }
      }
      return;
    }
  } catch (e) {
    console.warn("[propagateDocumentApproval] skipped:", e);
  }
}

export async function rejectRequest(id: number, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { ok: false, error: "Səbəb tələb olunur" };
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const cur = await prisma.tesdiq_telep.findUnique({
        where: { id },
        select: { status: true, emeliyyat_nov: true, resurs_nov: true, resurs_id: true, yaradan_id: true },
      });
      // Per-kind icazə yoxlanışı
      if (cur) {
        const allowed = await canApproveDocApproval(cur.emeliyyat_nov);
        if (!allowed) return { ok: false, error: "Bu növü rədd etmək icazəniz yoxdur" };
      }
      // 4-eyes prinsipi: öz yaratdığını rədd edə bilməzsən
      if (cur?.yaradan_id === istifadeciId) {
        return {
          ok: false,
          error: "Öz yaratdığınız sorğunu rədd edə bilməzsiniz. Ləğv etmək üçün ləğv düyməsindən istifadə edin.",
        };
      }
      await prisma.tesdiq_telep.update({
        where: { id },
        data: {
          status: "red",
          baxan_id: istifadeciId,
          netice_qeyd: reason.trim(),
          netice_tarix: new Date(),
        },
      });
      await logTransition(id, istifadeciId, cur?.status ?? null, "red", "redd_edildi", reason.trim());
      await audit("redd", "tesdiq_telep", id, {
        evvelki_data: { status: cur?.status ?? null },
        yeni_data: { status: "red", emeliyyat_nov: cur?.emeliyyat_nov, resurs_nov: cur?.resurs_nov, resurs_id: cur?.resurs_id },
        sebeb: reason.trim(),
      });

      // Rədd edildikdə original sənədi ləğv et
      if (cur?.resurs_nov && cur?.resurs_id) {
        const full = await prisma.tesdiq_telep.findUnique({
          where: { id },
          select: { detay_json: true },
        });
        await propagateDocumentReject(cur.emeliyyat_nov, cur.resurs_nov, cur.resurs_id, full?.detay_json);
      }

      revalidatePath("/tesdiq");
      revalidatePath(`/tesdiq/${id}`);
      revalidatePath("/ticaret/alislar");
      bustTesdiqCache();
      return { ok: true };
    } catch (e) {
      console.error("[rejectRequest]", e);
      return { ok: false, error: "Rədd edilmədi" };
    }
  });
}

async function propagateDocumentReject(
  emeliyyatNov: string,
  resursNov: string,
  resursId: string,
  detayJson?: unknown,
): Promise<void> {
  try {
    // Helper — sənəd ləğv edildikdə audit log yazır ki, müştəri "nə oldu?"
    // sualına cavab tarixçədə olsun.
    const writeReject = async (nov: string) => {
      await audit("legv", nov, resursId, {
        yeni_data: { status: "legv" },
        sebeb: "Təsdiq sorğusu rədd edildi",
      });
    };

    if (emeliyyatNov === "alis_qaime" && resursNov === "alis_sifarisi") {
      await prisma.alis_sifarisleri.update({
        where: { id: resursId },
        data: { status: "legv" },
      });
      await writeReject("alis_sifarisi");
      return;
    }
    if (emeliyyatNov === "satis_qaime" && resursNov === "satis_sifarisi") {
      await prisma.satis_sifarisleri.update({
        where: { id: resursId },
        data: { status: "legv" },
      });
      await writeReject("satis_sifarisi");
      return;
    }
    if (emeliyyatNov === "mehsul_yaratma" && resursNov === "mehsul") {
      const detay = detayJson as { tip?: "create" | "update" } | null;
      if (detay?.tip === "create") {
        await prisma.mehsullar.update({
          where: { id: resursId },
          data: { aktiv: false },
        });
        await writeReject("mehsul");
      }
      return;
    }
    if (emeliyyatNov === "ticaret_emeliyyat" && resursNov === "anbar_transferi") {
      await prisma.anbar_transferleri.update({
        where: { id: resursId },
        data: { status: "legv" },
      });
      await writeReject("anbar_transferi");
      return;
    }
    if (emeliyyatNov === "qaytarma" && resursNov === "qaytarma_sifarisi") {
      await prisma.qaytarma_sifarisleri.update({
        where: { id: resursId },
        data: { status: "legv" },
      });
      await writeReject("qaytarma_sifarisi");
      return;
    }
  } catch (e) {
    console.warn("[propagateDocumentReject] skipped:", e);
  }
}

export async function cancelRequest(id: number, reason?: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const cur = await prisma.tesdiq_telep.findUnique({ where: { id }, select: { status: true, yaradan_id: true } });
      if (!cur) return { ok: false, error: "Tapılmadı" };
      // Only the creator can cancel a pending request
      if (cur.yaradan_id !== istifadeciId) return { ok: false, error: "Yalnız yaradan ləğv edə bilər" };
      if (cur.status !== "gozleyir") return { ok: false, error: "Yalnız gözləyən sorğu ləğv edilə bilər" };
      await prisma.tesdiq_telep.update({
        where: { id },
        data: { status: "legv", netice_qeyd: reason ?? null, netice_tarix: new Date() },
      });
      await logTransition(id, istifadeciId, cur.status, "legv", "legv_edildi", reason);
      await audit("legv", "tesdiq_telep", id, {
        evvelki_data: { status: cur.status },
        yeni_data: { status: "legv" },
        sebeb: reason ?? undefined,
      });
      revalidatePath("/tesdiq");
      revalidatePath(`/tesdiq/${id}`);
      bustTesdiqCache();
      return { ok: true };
    } catch (e) {
      console.error("[cancelRequest]", e);
      return { ok: false, error: "Ləğv edilmədi" };
    }
  });
}

export async function bulkApprove(ids: number[]): Promise<BulkResult> {
  if (!ids.length) return { ok: false, error: "Heç bir element seçilməyib" };
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      // Per-kind icazə yoxlanışı — hər ID üçün ayrı
      const docs = await prisma.tesdiq_telep.findMany({
        where: { id: { in: ids } },
        select: { id: true, emeliyyat_nov: true, yaradan_id: true },
      });
      // Bütün unikal növlər üçün icazəni paralel yoxla
      const uniqueKinds = Array.from(new Set(docs.map((d) => d.emeliyyat_nov)));
      const allowedKindEntries = await Promise.all(
        uniqueKinds.map(async (k) => [k, await canApproveDocApproval(k)] as const),
      );
      const allowedKindMap = new Map(allowedKindEntries);
      // Yalnız (a) icazəli olan növlər + (b) özümünkü olmayanlar
      const validIds = docs
        .filter((d) => d.yaradan_id !== istifadeciId && allowedKindMap.get(d.emeliyyat_nov))
        .map((d) => d.id);
      const skippedSelf = ids.length - validIds.length;
      if (validIds.length === 0) {
        return { ok: false, error: "Hamısı sizin yaratdığınız sorğulardır — başqa şəxs təsdiq etməlidir" };
      }
      const result = await prisma.tesdiq_telep.updateMany({
        where: { id: { in: validIds }, status: "gozleyir" },
        data: {
          status: "tesdiq",
          baxan_id: istifadeciId,
          netice_qeyd: skippedSelf > 0
            ? `Bulk təsdiq (${skippedSelf} öz sorğu skip edildi)`
            : "Bulk təsdiq",
          netice_tarix: new Date(),
        },
      });
      // Log each transition (yalnız uyğun olanlar)
      await Promise.all(
        validIds.map((id) => logTransition(id, istifadeciId, "gozleyir", "tesdiq", "bulk_tesdiq", "Bulk təsdiq"))
      );
      // Audit log — bulk təsdiq əməliyyatı
      await audit("tesdiq", "tesdiq_telep_bulk", null, {
        yeni_data: { ids: validIds, affected: result.count, status: "tesdiq" },
        sebeb: skippedSelf > 0 ? `Bulk təsdiq (${skippedSelf} öz sorğu skip)` : "Bulk təsdiq",
      });
      revalidatePath("/tesdiq");
      bustTesdiqCache();
      return { ok: true, affected: result.count };
    } catch (e) {
      console.error("[bulkApprove]", e);
      return { ok: false, error: "Bulk təsdiq alınmadı" };
    }
  });
}

export async function bulkReject(ids: number[], reason: string): Promise<BulkResult> {
  if (!ids.length) return { ok: false, error: "Heç bir element seçilməyib" };
  if (!reason.trim()) return { ok: false, error: "Səbəb tələb olunur" };
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const docs = await prisma.tesdiq_telep.findMany({
        where: { id: { in: ids } },
        select: { id: true, emeliyyat_nov: true, yaradan_id: true },
      });
      const uniqueKinds = Array.from(new Set(docs.map((d) => d.emeliyyat_nov)));
      const allowedKindEntries = await Promise.all(
        uniqueKinds.map(async (k) => [k, await canApproveDocApproval(k)] as const),
      );
      const allowedKindMap = new Map(allowedKindEntries);
      const validRejectIds = docs
        .filter((d) => d.yaradan_id !== istifadeciId && allowedKindMap.get(d.emeliyyat_nov))
        .map((d) => d.id);
      if (validRejectIds.length === 0) {
        return { ok: false, error: "Heç bir sənəd üçün rədd icazəniz yoxdur" };
      }
      const result = await prisma.tesdiq_telep.updateMany({
        where: { id: { in: validRejectIds }, status: "gozleyir" },
        data: {
          status: "red",
          baxan_id: istifadeciId,
          netice_qeyd: reason.trim(),
          netice_tarix: new Date(),
        },
      });
      await Promise.all(
        validRejectIds.map((id) => logTransition(id, istifadeciId, "gozleyir", "red", "bulk_red", reason.trim()))
      );
      await audit("redd", "tesdiq_telep_bulk", null, {
        yeni_data: { ids: validRejectIds, affected: result.count, status: "red" },
        sebeb: reason.trim(),
      });
      revalidatePath("/tesdiq");
      bustTesdiqCache();
      return { ok: true, affected: result.count };
    } catch (e) {
      console.error("[bulkReject]", e);
      return { ok: false, error: "Bulk rədd alınmadı" };
    }
  });
}

export async function addComment(id: number, qeyd: string): Promise<ActionResult> {
  if (!qeyd.trim()) return { ok: false, error: "Qeyd boş ola bilməz" };
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      await logTransition(id, istifadeciId, null, "", "qeyd", qeyd.trim());
      revalidatePath(`/tesdiq/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[addComment]", e);
      return { ok: false, error: "Qeyd əlavə edilmədi" };
    }
  });
}
