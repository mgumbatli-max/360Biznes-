"use server";

import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { prisma } from "@/lib/db/prisma";

export type OpenInvoice = {
  id: string;
  nomre: string;
  tarix: string; // ISO date — serializable for client
  son_mebleg: number;
  odenilmis: number;
  qalig: number;
  gun: number; // tarixdən neçə gün keçib
};

export type CustomerSummary = {
  avans: number;
  cemi_qaliq: number;
  invoices: OpenInvoice[];
};

/**
 * Müştərinin açıq nisyə sənədlərini və cari avans balansını qaytarır.
 * Maliyyə Yeni Əməliyyat → Qaimə dialogunda müştəri seçildikdə çağırılır.
 */
export async function getCustomerOpenInvoicesAction(
  musteri_id: string,
): Promise<CustomerSummary> {
  if (!musteri_id) return { avans: 0, cemi_qaliq: 0, invoices: [] };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const [k, sales] = await Promise.all([
      prisma.kontragentler.findFirst({
        where: { id: musteri_id, sahibkar_id: sahibkarId },
        select: { avans: true },
      }),
      prisma.satis_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          musteri_id,
          status: { not: "legv" },
          qaralama: { not: true },
          odenis_nov: { in: ["nisye", "borc"] },
        },
        orderBy: { tarix: "asc" },
        take: 100,
        select: {
          id: true,
          nomre: true,
          tarix: true,
          son_mebleg: true,
          odenilmis: true,
        },
      }),
    ]);

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const invoices: OpenInvoice[] = sales
      .map((s) => {
        const son = Number(s.son_mebleg ?? 0);
        const od = Number(s.odenilmis ?? 0);
        const qalig = +(son - od).toFixed(2);
        const tarix = s.tarix instanceof Date ? s.tarix : new Date(s.tarix);
        return {
          id: s.id,
          nomre: s.nomre,
          tarix: tarix.toISOString(),
          son_mebleg: son,
          odenilmis: od,
          qalig,
          gun: Math.max(0, Math.floor((now - tarix.getTime()) / DAY)),
        };
      })
      .filter((s) => s.qalig > 0.01);

    return {
      avans: Number(k?.avans ?? 0),
      cemi_qaliq: +invoices.reduce((s, i) => s + i.qalig, 0).toFixed(2),
      invoices,
    };
  });
}
