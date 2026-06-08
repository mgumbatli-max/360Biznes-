"use server";

import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { prisma } from "@/lib/db/prisma";

export type OpenPurchase = {
  id: string;
  nomre: string;
  tarix: string; // ISO date — serializable
  qaime_nomre: string | null;
  umumi_mebleg: number;
  odenilmis: number;
  qalig: number;
  gun: number;
};

export type SupplierSummary = {
  cemi_qaliq: number;
  invoices: OpenPurchase[];
};

/**
 * Təchizatçının açıq alış sənədlərini qaytarır.
 * Maliyə Yeni Əməliyyat → Alış ödənişi və ya Borc ödənişi-də təchizatçı
 * seçildikdə çağırılır.
 */
export async function getSupplierOpenPurchasesAction(
  techizatci_id: string,
): Promise<SupplierSummary> {
  if (!techizatci_id) return { cemi_qaliq: 0, invoices: [] };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.alis_sifarisleri.findMany({
      where: {
        sahibkar_id: sahibkarId,
        techiazatci_id: techizatci_id,
        status: { not: "legv" },
      },
      orderBy: { tarix: "asc" },
      take: 100,
      select: {
        id: true,
        nomre: true,
        tarix: true,
        qaime_nomre: true,
        umumi_mebleg: true,
        odenilmis: true,
      },
    });

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const invoices: OpenPurchase[] = rows
      .map((r) => {
        const um = Number(r.umumi_mebleg ?? 0);
        const od = Number(r.odenilmis ?? 0);
        const qalig = +(um - od).toFixed(2);
        const tarix = r.tarix instanceof Date ? r.tarix : new Date(r.tarix);
        return {
          id: r.id,
          nomre: r.nomre,
          tarix: tarix.toISOString(),
          qaime_nomre: r.qaime_nomre,
          umumi_mebleg: um,
          odenilmis: od,
          qalig,
          gun: Math.max(0, Math.floor((now - tarix.getTime()) / DAY)),
        };
      })
      .filter((r) => r.qalig > 0.01);

    return {
      cemi_qaliq: +invoices.reduce((s, i) => s + i.qalig, 0).toFixed(2),
      invoices,
    };
  });
}
