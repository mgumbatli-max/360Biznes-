/**
 * Rol adı əsasında server-side yoxlama helper-ləri.
 * Multi-tenant arxitekturada rolId hər sahibkar üçün fərqli olur,
 * lakin rolAd ("admin", "sahibkar", "kassir" və s.) sabitdir.
 */

import { requireTenant, getTenant } from "@/lib/db/tenant-context";

/** Cari rol adı (tenant context-dən). */
export function currentRoleName(): string {
  const ctx = requireTenant();
  return ctx.rolAd ?? "";
}

/** Cari istifadəçi `admin` (platform admin) rolundadır? */
export function isAdmin(): boolean {
  return currentRoleName() === "admin";
}

/** Cari istifadəçi `sahibkar` rolundadır? */
export function isSahibkar(): boolean {
  return currentRoleName() === "sahibkar";
}

/** Cari istifadəçi `admin` və ya `sahibkar`-dır (ən yüksək icazəli)? */
export function isPrivileged(): boolean {
  const r = currentRoleName();
  return r === "admin" || r === "sahibkar";
}

/** Verilmiş rol adlarından hər hansı biri ilə uyğun gəlirmi? */
export function hasRole(...names: string[]): boolean {
  const r = currentRoleName();
  return names.includes(r);
}

/**
 * Tenant context yoxdursa, undefined qaytarır (auth tələb etmir).
 * Yalnız soft-check üçün — sərt yoxlama üçün `isSahibkar()` istifadə et.
 */
export function maybeRoleName(): string | undefined {
  return getTenant()?.rolAd;
}
