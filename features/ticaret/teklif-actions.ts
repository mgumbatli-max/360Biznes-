"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Update a teklif's status (e.g. gonderildi, qebul, redd, legv).
 */
export async function updateTeklifStatus(teklifId: string, status: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.teklifler.update({
        where: { id: teklifId },
        data: { status, yenilendi: new Date() },
      });
      revalidatePath("/ticaret/teklif");
      revalidatePath("/ticaret");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
    }
  });
}

/**
 * Convert a teklif into a real satis_sifarisleri. Creates a new sale plus
 * lines mirroring the quote, then links teklif.satish_id back. Stock is
 * not deducted here (sale starts as 'yeni' status) - that happens in POS or
 * via a separate flow.
 */
export async function convertTeklifToSale(teklifId: string): Promise<ActionResult<{ id: string }>> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const t = await tx.teklifler.findUnique({
          where: { id: teklifId },
          include: { teklif_satirlari: true },
        });
        if (!t) throw new Error("Təklif tapılmadı");
        if (t.satish_id) throw new Error("Bu təklif artıq satışa çevrilib");

        // Generate sale number: SF + yyyyMMdd + 4 hex
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
        const nomre = `SF-${dateStr}-${suffix}`;

        // Pick first anbar for sahibkar (fallback)
        const firstAnbar = await tx.anbarlar.findFirst({
          where: { sahibkar_id: sahibkarId },
          select: { id: true },
          orderBy: { id: "asc" },
        });

        const sale = await tx.satis_sifarisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            musteri_id: t.musteri_id,
            anbar_id: firstAnbar?.id ?? null,
            tarix: new Date(),
            status: "yeni",
            odenis_nov: "negd",
            umumi_mebleg: t.umumi_meblegh ?? 0,
            endirim_mebleg: t.endirim_meblegh ?? 0,
            son_mebleg: t.son_meblegh ?? 0,
            odenilmis: 0,
            qeyd: t.qeyd ?? `Təklif #${t.nomre} əsasında`,
            yaradan_id: istifadeciId,
            satis_meneceri_id: t.menecer_id,
            filial_id: t.filial_id,
            qaralama: false,
          },
        });

        // Copy lines
        for (const line of t.teklif_satirlari) {
          if (!line.mehsul_id) continue;
          await tx.satis_sifaris_satirlari.create({
            data: {
              sahibkar_id: sahibkarId,
              sifaris_id: sale.id,
              mehsul_id: line.mehsul_id,
              miqdar: line.sayi,
              vahid_qiymet: line.qiymet,
              endirim_faiz: line.endirim_faiz ?? 0,
            },
          });
        }

        // Link teklif → sale
        await tx.teklifler.update({
          where: { id: t.id },
          data: { satish_id: sale.id, status: "qebul", yenilendi: new Date() },
        });

        return { id: sale.id };
      });

      revalidatePath("/ticaret/teklif");
      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret");
      return { ok: true, data: result };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
    }
  });
}

/**
 * Delete a teklif (only if not converted).
 */
export async function deleteTeklif(teklifId: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      const t = await prisma.teklifler.findUnique({
        where: { id: teklifId },
        select: { satish_id: true },
      });
      if (!t) return { ok: false, error: "Təklif tapılmadı" };
      if (t.satish_id) return { ok: false, error: "Satışa çevrilmiş təklifi silmək olmaz" };

      await prisma.teklifler.delete({ where: { id: teklifId } });
      revalidatePath("/ticaret/teklif");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
    }
  });
}
