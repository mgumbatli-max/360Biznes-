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
export type SupplierOpt = { id: string; ad: string; telefon: string | null };

export type SatisOptions = {
  anbarlar: AnbarOpt[];
  saticilar: SalespersonOption[];
};
export type AlisOptions = {
  anbarlar: AnbarOpt[];
  suppliers: SupplierOpt[];
  menecerler: SalespersonOption[];
};

export async function getSatisOptions(): Promise<SatisOptions> {
  return withTenant(async () => {
    requireTenant();
    const [anbarlar, saticilar] = await Promise.all([
      prisma.anbarlar.findMany({
        where: { aktiv: true },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true },
      }),
      getSalespersonOptions(),
    ]);
    return { anbarlar, saticilar };
  });
}

export async function getAlisOptions(): Promise<AlisOptions> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [anbarlar, suppliers, menecerler] = await Promise.all([
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
        select: { id: true, ad: true, telefon: true },
        take: 500,
      }),
      getSalespersonOptions(),
    ]);
    return { anbarlar, suppliers, menecerler };
  });
}
