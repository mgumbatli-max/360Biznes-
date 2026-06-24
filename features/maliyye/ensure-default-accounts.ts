import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Yeni tenant üçün default maliyə hesabları (nağd/kart/bank).
 * Bunlar olmadan yeni sahibkar nağd/kart satışı edə bilmir
 * (satis-yeni-actions: ödəniş hesabı tapılmasa satış rədd olunur).
 */
export const DEFAULT_FINANCE_ACCOUNTS = [
  { ad: "Nağd kassa", nov: "negd" },
  { ad: "Kart / POS terminal", nov: "kart" },
  { ad: "Bank hesabı", nov: "bank" },
] as const;

/**
 * Tenant-də heç bir maliyə hesabı yoxdursa, 3 default yaradır (nağd/kart/bank).
 * İDEMPOTENT — hesab varsa heç nə etmir. Həm signup (yeni tenant), həm də mövcud
 * sıfır-data tenant-ların self-heal-i üçün (satış/maliyyə axınlarından çağırılır).
 */
export async function ensureDefaultFinanceAccounts(
  client: PrismaClient | Prisma.TransactionClient,
  sahibkarId: string,
): Promise<void> {
  const count = await client.maliye_hesablari.count({ where: { sahibkar_id: sahibkarId } });
  if (count > 0) return;
  await client.maliye_hesablari.createMany({
    data: DEFAULT_FINANCE_ACCOUNTS.map((d) => ({
      sahibkar_id: sahibkarId,
      ad: d.ad,
      nov: d.nov,
      qaliq: 0,
      valyuta: "AZN",
      aktiv: true,
    })),
    skipDuplicates: true,
  });
}

/**
 * Cari tenant üçün default hesabları təmin et (mövcud sıfır-data tenant-ların
 * backfill-i). Maliyyə bölməsi yüklənəndə çağırılır ki, hesab dropdown-ları boş
 * qalmasın. İdempotent + ucuz (count sorğusu).
 */
export async function ensureDefaultFinanceAccountsForCurrentTenant(): Promise<void> {
  await withTenant(async () => {
    const { sahibkarId } = requireTenant();
    await ensureDefaultFinanceAccounts(prismaUnscoped, sahibkarId);
  });
}
