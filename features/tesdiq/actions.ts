"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { canApproveDocApproval, isFullDocApproval } from "./permissions";

type ActionResult = { ok: true } | { ok: false; error: string };
type BulkResult = { ok: true; affected: number } | { ok: false; error: string };

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
      // Təchizatçı borcunu artır (createPurchase təsdiq-gözləyəndə skip etmişdi)
      if (purchase.techiazatci_id && purchase.umumi_mebleg != null) {
        await prisma.kontragentler.update({
          where: { id: purchase.techiazatci_id },
          data: { borc: { decrement: purchase.umumi_mebleg } },
        });
      }
      return;
    }
    if (emeliyyatNov === "satis_qaime" && resursNov === "satis_sifarisi") {
      const sale = await prisma.satis_sifarisleri.findUnique({
        where: { id: resursId },
        select: { status: true },
      });
      // Təsdiqdən sonra status "yeni"-yə düşür — qaimə istifadəçi üçün
      // adi yeni satış kimi siyahıda görünür. Stok endirilməsi və ödəniş
      // əməliyyatları üçün satıcı "Tamamla" düyməsindən istifadə edir
      // (createOrUpdateSatisYeni satışı təsdiq-gözləyən kimi yaratdığı üçün
      // post-qaralama finalize bloku işləməmişdi).
      if (sale?.status === "tesdiq_gozleyir") {
        await prisma.satis_sifarisleri.update({
          where: { id: resursId },
          data: { status: "yeni" },
        });
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
    if (emeliyyatNov === "alis_qaime" && resursNov === "alis_sifarisi") {
      await prisma.alis_sifarisleri.update({
        where: { id: resursId },
        data: { status: "legv" },
      });
      return;
    }
    if (emeliyyatNov === "satis_qaime" && resursNov === "satis_sifarisi") {
      await prisma.satis_sifarisleri.update({
        where: { id: resursId },
        data: { status: "legv" },
      });
      return;
    }
    if (emeliyyatNov === "mehsul_yaratma" && resursNov === "mehsul") {
      const detay = detayJson as { tip?: "create" | "update" } | null;
      // create rədd: draft məhsulu sil (heç vaxt aktiv olmadı)
      // update rədd: original məhsul dəyişməyib — heç nə etmə
      if (detay?.tip === "create") {
        // Hard delete deyil — referans bütünlüyü üçün passiv saxla.
        // (Əgər heç bir əlaqəli stok/satış yoxdursa təhlükəsizdir sırf passiv qoymaq)
        await prisma.mehsullar.update({
          where: { id: resursId },
          data: { aktiv: false },
        });
      }
      return;
    }
    if (emeliyyatNov === "ticaret_emeliyyat" && resursNov === "anbar_transferi") {
      await prisma.anbar_transferleri.update({
        where: { id: resursId },
        data: { status: "legv" },
      });
      return;
    }
    if (emeliyyatNov === "qaytarma" && resursNov === "qaytarma_sifarisi") {
      await prisma.qaytarma_sifarisleri.update({
        where: { id: resursId },
        data: { status: "legv" },
      });
      return;
    }
    // xerc: rədd halında xərc qeydini silmək — yalnız istifadəçi qərarı ilə
    // (auto-silmə kassa balansını dolanlıdıra bilər)
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
      revalidatePath("/tesdiq");
      revalidatePath(`/tesdiq/${id}`);
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
      revalidatePath("/tesdiq");
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
        where: { id: { in: ids }, status: "gozleyir" },
        data: {
          status: "red",
          baxan_id: istifadeciId,
          netice_qeyd: reason.trim(),
          netice_tarix: new Date(),
        },
      });
      await Promise.all(
        ids.map((id) => logTransition(id, istifadeciId, "gozleyir", "red", "bulk_red", reason.trim()))
      );
      revalidatePath("/tesdiq");
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
