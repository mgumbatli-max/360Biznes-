"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type PayrollAccount = {
  id: string;
  ad: string;
  nov: string;
  qaliq: number;
  valyuta: string;
};

export async function getPayrollAccountsAction(): Promise<PayrollAccount[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.maliye_hesablari.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      orderBy: [{ nov: "asc" }, { ad: "asc" }],
      select: { id: true, ad: true, nov: true, qaliq: true, valyuta: true },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      nov: r.nov,
      qaliq: Number(r.qaliq ?? 0),
      valyuta: r.valyuta ?? "AZN",
    }));
  });
}
