import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Blocker } from "./types";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Satışı ləğv/silmə cəhdində bloklayan əlaqəli sənədləri qaytarır.
 *
 * Hazırkı blockerlar:
 *   1. Ödəniş (finance_operations.satis_id) — istifadəçi birbaşa ödənişə klik edib
 *      orada Sil düyməsi tapa bilər.
 *   2. Qaytarma sənədi (qaytarma_sifarisleri.satis_id)
 *   3. Çatdırma (catdirmalar.satis_id) — yola düşmüş çatdırma silinmir.
 *   4. Kampaniya istifadəsi (campaign_usage.satis_id) — yumşaq.
 */
export async function findSaleBlockers(
  saleId: string,
  tx: TxClient = prisma,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];

  // 1) Ödənişlər (finance_operations) — schema-da field adı `meblegh`
  const payments = await tx.finance_operations.findMany({
    where: { satis_id: saleId, deleted_at: null },
    select: {
      id: true,
      meblegh: true,
      tarix: true,
      qeyd: true,
    },
    orderBy: { tarix: "desc" },
    take: 20,
  });
  for (const p of payments) {
    const mebleg = Number(p.meblegh ?? 0);
    const dateStr = p.tarix ? new Date(p.tarix).toLocaleDateString("az-AZ") : "";
    blockers.push({
      type: "odenis",
      id: p.id,
      label: `${mebleg.toFixed(2)} ₼ ${dateStr ? `— ${dateStr}` : ""}`.trim(),
      href: `/maliyye/emeliyyat/${p.id}`,
      amount: mebleg,
      tarix: p.tarix ?? undefined,
    });
  }

  // 2) Qaytarma sənədləri (qaytarma_sifarisleri.original_id satışa link verir)
  try {
    const returns = await tx.qaytarma_sifarisleri.findMany({
      where: {
        original_id: saleId,
        nov: "satis_qaytarma",
        deleted_at: null,
        status: { notIn: ["legv"] },
      },
      select: { id: true, nomre: true, status: true, umumi_mebleg: true, tarix: true },
      take: 10,
    });
    for (const r of returns) {
      blockers.push({
        type: "qaytarma",
        id: r.id,
        label: `${r.nomre} — ${Number(r.umumi_mebleg ?? 0).toFixed(2)} ₼`,
        href: `/ticaret/qaytarmalar/${r.id}`,
        amount: Number(r.umumi_mebleg ?? 0),
        tarix: r.tarix ?? undefined,
        badge: r.status ?? undefined,
      });
    }
  } catch {
    /* model yoxdursa, skip */
  }

  // 3) Çatdırma — aktiv statuslar
  try {
    const deliveries = await tx.catdirmalar.findMany({
      where: { satis_id: saleId },
      select: { id: true, status: true },
      take: 5,
    });
    for (const c of deliveries) {
      if (c.status && ["kuryere_verildi", "yolda", "tehvil_verildi"].includes(c.status)) {
        blockers.push({
          type: "satis",
          id: c.id,
          label: `Çatdırma (${c.status})`,
          href: `/catdirma/${c.id}`,
          badge: c.status,
        });
      }
    }
  } catch {
    /* model yoxdursa, skip */
  }

  return blockers;
}
