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
  const rows = await prismaUnscoped.rol_icazeleri.findMany({
    where: { rol_id: rolId },
    include: { icazeler: { select: { kod: true } } },
  });
  return rows.map((r) => r.icazeler.kod).filter(Boolean);
}
