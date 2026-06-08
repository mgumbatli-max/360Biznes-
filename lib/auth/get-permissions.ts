import { cache } from "react";
import { auth } from "@/auth";
import { loadPermissionsForRole, loadAllPermissionCodes } from "./permissions";

/**
 * Server-only cached loader for the current user's permission codes.
 *
 * `cache()` deduplicates within a single React request render, so calling
 * this from multiple Server Components in the same render does one DB hit.
 *
 * For cross-request caching, layer Redis on top later (mərhələ 9+).
 */
export const getRequestPermissions = cache(async (): Promise<string[]> => {
  const session = await auth();
  if (!session?.user?.rol_id) return [];
  // Sahibkar/admin = tam giriş (bütün icazələr). Owner rolu klonlandığı üçün
  // rol_id etibarsızdır (audit #14), ona görə AD ilə yoxlanılır. Bu, owner-in
  // hansısa icazə prod-da seed olunmadıqda dashboard və s.-dən kilidlənməsinin
  // qarşısını alır (lokal=prod davranış).
  const rolAd = ((session.user as { rol_ad?: string }).rol_ad ?? "").toLowerCase();
  if (rolAd === "sahibkar" || rolAd === "admin") {
    return loadAllPermissionCodes();
  }
  return loadPermissionsForRole(session.user.rol_id);
});

export const getRequestUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});
