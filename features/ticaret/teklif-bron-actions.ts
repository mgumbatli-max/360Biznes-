"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Reserve stock for every line of an existing quote. Creates stok_bron entries
 * with bitme_tarixi=quote.bitme_tarixi. Idempotent: existing aktiv reservations
 * for the quote are not duplicated.
 */
export async function reserveQuoteStock(teklifId: string, anbarId?: number): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const t = await prisma.teklifler.findUnique({
        where: { id: teklifId },
        include: { teklif_satirlari: true },
      });
      if (!t) return { ok: false, error: "Təklif tapılmadı" };
      if (t.satish_id) return { ok: false, error: "Bu təklif artıq satışa çevrilib" };

      // Skip if already has aktiv reservations
      const existing = await prisma.stok_bron.count({
        where: { sahibkar_id: sahibkarId, status: "aktiv", qeyd: { contains: `teklif:${teklifId}` } },
      });
      if (existing > 0) {
        return { ok: false, error: "Bu təklif üçün rezerv artıq mövcuddur" };
      }

      // Default anbar
      let useAnbar = anbarId;
      if (!useAnbar) {
        const first = await prisma.anbarlar.findFirst({
          where: { sahibkar_id: sahibkarId, aktiv: true },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        useAnbar = first?.id;
      }

      for (const line of t.teklif_satirlari) {
        if (!line.mehsul_id) continue;
        await prisma.stok_bron.create({
          data: {
            sahibkar_id: sahibkarId,
            mehsul_id: line.mehsul_id,
            anbar_id: useAnbar ?? null,
            musteri_id: t.musteri_id,
            musteri_ad: t.musteri_ad,
            sayi: line.sayi,
            qiymet: line.qiymet,
            baslama_tarixi: new Date(),
            bitme_tarixi: t.bitme_tarixi,
            status: "aktiv",
            qeyd: `teklif:${t.id} (${t.nomre})`,
            yaradan_id: istifadeciId,
          },
        });
      }

      revalidatePath("/ticaret/teklif");
      revalidatePath("/anbar/bron");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

/**
 * Release reservations belonging to a quote (used when quote is rejected,
 * deleted, expired, or converted to a sale).
 */
export async function releaseQuoteStock(teklifId: string): Promise<ActionResult<{ released: number }>> {
  return withTenant(async () => {
    try {
      const r = await prisma.stok_bron.updateMany({
        where: { status: "aktiv", qeyd: { contains: `teklif:${teklifId}` } },
        data: { status: "legv" },
      });
      revalidatePath("/ticaret/teklif");
      revalidatePath("/anbar/bron");
      return { ok: true, data: { released: r.count } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

/**
 * Mark every quote whose bitme_tarixi is past as `vaxti_bitdi` and release
 * its reservations. Returns the number of quotes affected. Used by both the
 * cron endpoint and the "Vaxtı bitmişləri yenilə" button on the quote list.
 */
export async function expireOldQuotes(): Promise<ActionResult<{ expired: number; releasedRows: number }>> {
  return withTenant(async () => {
    try {
      const now = new Date();
      const old = await prisma.teklifler.findMany({
        where: {
          satish_id: null,
          bitme_tarixi: { lt: now },
          status: { in: ["qaralama", "gonderildi", "qebul"] },
        },
        select: { id: true },
      });

      let releasedRows = 0;
      for (const t of old) {
        const r = await prisma.stok_bron.updateMany({
          where: { status: "aktiv", qeyd: { contains: `teklif:${t.id}` } },
          data: { status: "vaxti_bitdi" },
        });
        releasedRows += r.count;
      }

      const upd = await prisma.teklifler.updateMany({
        where: { id: { in: old.map((t) => t.id) } },
        data: { status: "vaxti_bitdi", yenilendi: now },
      });

      revalidatePath("/ticaret/teklif");
      revalidatePath("/anbar/bron");
      return { ok: true, data: { expired: upd.count, releasedRows } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}
