import { cache } from "react";
import { auth } from "@/auth";
import { loadPermissionsForRole } from "./permissions";

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
  return loadPermissionsForRole(session.user.rol_id);
});

export const getRequestUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});
