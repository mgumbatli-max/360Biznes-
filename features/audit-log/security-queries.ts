import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export async function getBlockedIps() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.ip_bloklari.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: { yaradildi: "desc" },
      include: { istifadeciler: { select: { ad_soyad: true, email: true } } },
    });
  });
}

export async function getRecentFailedLogins(hours = 24, limit = 50) {
  // giris_cehdleri is global (no sahibkar_id) — filter by recent time
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return prisma.giris_cehdleri.findMany({
    where: { ugurlu: false, yaradildi: { gte: cutoff } },
    orderBy: { yaradildi: "desc" },
    take: limit,
  });
}

export async function getLoginRules() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.istifadeci_giris_qaydalari.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: { yaradildi: "desc" },
      include: {
        istifadeciler: { select: { id: true, ad_soyad: true, email: true } },
      },
    });
  });
}

export async function getAuditRowDetail(id: bigint) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.audit_log.findFirst({
      where: { id, sahibkar_id: sahibkarId },
      include: {
        istifadeciler: { select: { id: true, ad_soyad: true, email: true } },
      },
    });
  });
}
