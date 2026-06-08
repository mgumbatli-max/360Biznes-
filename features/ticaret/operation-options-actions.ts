"use server";

/**
 * Lightweight on-demand option fetchers for the "Yeni əməliyyat" modals.
 *
 * The new-operation-dialog renders on multiple pages (ticaret hub,
 * əməliyyatlar). Rather than push the same prop bundle through every parent,
 * the modals fetch their dropdown options the first time they are opened.
 */

import { withTenant } from "@/lib/db/with-tenant";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
import { getSalespersonOptions, type SalespersonOption } from "@/features/pos/sale-queries";

export type AnbarOpt = { id: number; ad: string };
export type SupplierOpt = {
  id: string;
  ad: string;
  telefon: string | null;
  /** Bizim təchizatçıya cari borcumuz (kreditor). 0-dırsa borc yoxdur. */
  borc: number;
};
/** Kassa — nəğd ödənişlər üçün. */
export type KassaOpt = { id: string; ad: string };
/** Bank hesabı — kart/köçürmə ödənişlər üçün. */
export type HesabOpt = { id: string; ad: string; nov: string; bank_adi: string | null };

export type SatisOptions = {
  anbarlar: AnbarOpt[];
  saticilar: SalespersonOption[];
  kassalar: KassaOpt[];
  hesablar: HesabOpt[];
};
export type AlisOptions = {
  anbarlar: AnbarOpt[];
  suppliers: SupplierOpt[];
  menecerler: SalespersonOption[];
  kassalar: KassaOpt[];
  hesablar: HesabOpt[];
};

export async function getSatisOptions(): Promise<SatisOptions> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [anbarlar, saticilar, kassalar, hesablar] = await Promise.all([
      prisma.anbarlar.findMany({
        where: { aktiv: true },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true },
      }),
      getSalespersonOptions(),
      prisma.kassalar.findMany({
        where: { sahibkar_id: sahibkarId, status: { not: "legv" } },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true },
        take: 50,
      }),
      prisma.maliye_hesablari.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true, nov: { in: ["bank", "kart", "e_pul"] } },
        orderBy: [{ nov: "asc" }, { ad: "asc" }],
        select: { id: true, ad: true, nov: true, bank_adi: true },
        take: 50,
      }),
    ]);
    return { anbarlar, saticilar, kassalar, hesablar };
  });
}

export async function getAlisOptions(): Promise<AlisOptions> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [anbarlar, suppliers, menecerler, kassalar, hesablar] = await Promise.all([
      prisma.anbarlar.findMany({
        where: { aktiv: true },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true },
      }),
      prisma.kontragentler.findMany({
        where: {
          sahibkar_id: sahibkarId,
          nov: { in: ["techizatci", "her_ikisi"] },
          aktiv: true,
        },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true, telefon: true, borc: true, alacaq: true },
        take: 500,
      }),
      getSalespersonOptions(),
      prisma.kassalar.findMany({
        where: { sahibkar_id: sahibkarId, status: { not: "legv" } },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true },
        take: 50,
      }),
      prisma.maliye_hesablari.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true, nov: { in: ["bank", "kart", "e_pul"] } },
        orderBy: [{ nov: "asc" }, { ad: "asc" }],
        select: { id: true, ad: true, nov: true, bank_adi: true },
        take: 50,
      }),
    ]);

    // Açıq alış sənədlərindən faktiki borc cəmlə
    const supplierIds = suppliers.map((s) => s.id);
    let openMap = new Map<string, number>();
    if (supplierIds.length > 0) {
      const openAgg = await prisma.$queryRaw<{ techiazatci_id: string; total: number | string | null }[]>`
        SELECT techiazatci_id::text AS techiazatci_id,
               COALESCE(SUM(umumi_mebleg - COALESCE(odenilmis, 0)), 0)::float AS total
          FROM alis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND techiazatci_id = ANY(${supplierIds}::uuid[])
           AND status <> 'legv'
           AND umumi_mebleg - COALESCE(odenilmis, 0) > 0
         GROUP BY techiazatci_id
      `;
      openMap = new Map(openAgg.map((o) => [o.techiazatci_id, Number(o.total ?? 0)]));
    }

    const suppliersWithBorc = suppliers.map((s) => ({
      id: s.id,
      ad: s.ad,
      telefon: s.telefon,
      borc: Math.max(Number(s.borc ?? 0), openMap.get(s.id) ?? 0),
    }));

    return { anbarlar, suppliers: suppliersWithBorc, menecerler, kassalar, hesablar };
  });
}
