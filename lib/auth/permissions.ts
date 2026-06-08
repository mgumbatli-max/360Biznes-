import { unstable_cache } from "next/cache";
import { prismaUnscoped } from "@/lib/db/prisma";

/**
 * Permission catalog. The full list (~130+) is loaded from the `icazeler` table,
 * but we expose a small typed core of common codes for compile-time safety.
 * Use string literals (matched against `icazeler` codes) elsewhere.
 */
export const CORE_PERMS = {
  // Trade
  SATIS_VIEW: "trade.view",
  SATIS_CREATE: "trade.create_sale",
  SATIS_EDIT: "trade.edit_sale",
  SATIS_DELETE: "trade.delete_operation",
  ALIS_CREATE: "trade.create_purchase",
  // Warehouse
  ANBAR_VIEW: "anbar.view",
  ANBAR_CREATE: "anbar.create",
  MEHSUL_EDIT: "mehsul.edit",
  // Finance
  MALIYE_VIEW: "maliye.view",
  // Admin
  ISTIFADECI_IDARE: "istifadeci.idare",
  ROL_IDARE: "rol.idare",
  AUDIT_VIEW: "audit.view",
  // Sahibkar
  SAHIBKAR_ACCESS: "sahibkar.access",
} as const;

export type PermissionCode = string;

/** Server-side: check whether the current user has at least one of the codes. */
export function hasAnyPermission(userIcazeler: string[], ...codes: PermissionCode[]): boolean {
  if (!userIcazeler?.length) return false;
  return codes.some((c) => userIcazeler.includes(c));
}

/** Server-side: check whether the current user has all of the codes. */
export function hasAllPermissions(userIcazeler: string[], ...codes: PermissionCode[]): boolean {
  if (!userIcazeler?.length) return false;
  return codes.every((c) => userIcazeler.includes(c));
}

/** Load permission codes for a role from the DB (unscoped — global catalog). */
export async function loadPermissionsForRole(rolId: number): Promise<string[]> {
  // Rollar nadir hallarda dəyişir — 5 dəqiqə cross-request cache.
  // Rol icazələri yeniləndikdə revalidateTag(`role-perms:${rolId}`) çağırılmalıdır.
  const cached = unstable_cache(
    async () => {
      const rows = await prismaUnscoped.rol_icazeleri.findMany({
        where: { rol_id: rolId },
        include: { icazeler: { select: { kod: true } } },
      });
      return rows.map((r) => r.icazeler.kod).filter(Boolean);
    },
    ["role-perms", String(rolId)],
    { revalidate: 300, tags: [`role-perms:${rolId}`] },
  );
  return cached();
}

/**
 * Qlobal icazə kataloqundakı BÜTÜN kodlar — sahibkar/admin tam-giriş üçün.
 * (Owner rolu klonlandığı üçün rol_id etibarsızdır — audit #14; ona görə
 * tam giriş ad ilə müəyyən olunub icazələr buradan verilir, data seed-dən asılı yox.)
 */
export async function loadAllPermissionCodes(): Promise<string[]> {
  const cached = unstable_cache(
    async () => {
      const rows = await prismaUnscoped.icazeler.findMany({ select: { kod: true } });
      return rows.map((r) => r.kod).filter((k): k is string => Boolean(k));
    },
    ["all-perm-codes"],
    { revalidate: 300, tags: ["all-perm-codes"] },
  );
  return cached();
}
