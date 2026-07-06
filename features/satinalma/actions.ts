"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { permGate } from "@/lib/auth/role-check";

type ActionResult = { ok: true; nomre?: string; sifaris_id?: string } | { ok: false; error: string };

/**
 * Auto-create a purchase order from current recommendations, grouped by supplier.
 * Produces 1..N alis_sifarisleri rows + alis_sifaris_satirlari.
 */
export async function autoCreatePurchaseOrders(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    { const _pg = permGate("alis.yarat", "alis.idare", "anbar.idare"); if (!_pg.ok) return _pg; } // QA-audit: real alış sifarişi yaradır
    try {
      const recs = await prisma.satinalma_tovsiye.findMany({
        where: { alis_yaradildi: false, tovsiye_say: { gt: 0 } },
        take: 200,
      });
      if (recs.length === 0) return { ok: false, error: "Tövsiyə yoxdur" };

      // Group by supplier
      const groups = new Map<string, typeof recs>();
      for (const r of recs) {
        const key = r.techizatci_id ?? "__no_supplier__";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }

      let count = 0;
      for (const [supplierKey, list] of groups) {
        const sup = supplierKey === "__no_supplier__" ? null : supplierKey;
        const nomre = `AS-${Date.now()}-${count}`;
        const sif = await prisma.alis_sifarisleri.create({
          data: {
            nomre,
            sahibkar_id: sahibkarId,
            techiazatci_id: sup,
            status: "gozlemede",
            yaradan_id: istifadeciId,
            tarix: new Date(),
            umumi_mebleg: list.reduce(
              (s, r) => s + Number(r.tovsiye_say ?? 0) * Number(r.son_alish_qiy ?? 0),
              0
            ),
          },
        });
        await prisma.alis_sifaris_satirlari.createMany({
          data: list
            .filter((r) => r.mehsul_id)
            .map((r) => ({
              sifaris_id: sif.id,
              mehsul_id: r.mehsul_id!,
              miqdar: r.tovsiye_say ?? 0,
              vahid_qiymet: r.son_alish_qiy ?? 0,
              sahibkar_id: sahibkarId,
            })),
        });
        await prisma.satinalma_tovsiye.updateMany({
          where: { id: { in: list.map((r) => r.id) } },
          data: { alis_yaradildi: true, alis_id: sif.id, durum: "alish_yaradildi" },
        });
        count++;
      }

      revalidatePath("/anbar/satinalma");
      revalidatePath("/ticaret/alislar");
      return { ok: true, count };
    } catch (e) {
      console.error("[autoCreatePurchaseOrders]", e);
      return { ok: false, error: "Sifariş yaradılmadı" };
    }
  });
}

export async function setReorderPoint(mehsulId: string, minStok: number): Promise<ActionResult> {
  return withTenant(async () => {
    { const _pg = permGate("anbar.idare", "alis.idare"); if (!_pg.ok) return _pg; } // QA-audit: guard yox idi
    // QA-audit: client-dən gələn minStok validasiya olunmurdu (mənfi/overflow/NaN birbaşa DB-yə).
    if (!Number.isFinite(minStok) || minStok < 0 || minStok > 1_000_000) {
      return { ok: false, error: "Minimum stok 0–1.000.000 aralığında olmalıdır" };
    }
    try {
      await prisma.mehsullar.update({
        where: { id: mehsulId },
        data: { min_stok: Math.round(minStok) },
      });
      revalidatePath("/anbar/satinalma");
      revalidatePath(`/anbar/inventar`);
      return { ok: true };
    } catch (e) {
      console.error("[setReorderPoint]", e);
      return { ok: false, error: "Saxlanılmadı" };
    }
  });
}
