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

/**
 * QA-audit: withTenant() DAXİLİNDƏ çağırılan sərt icazə guard-ı. Privileged (admin/sahibkar)
 * bypass edir; digərləri verilmiş icazələrdən ən azı birinə malik olmalıdır, yoxsa THROW.
 * Guard-sız qalmış action-lara (qiymet-kanal, avtomatlasdirma, alerts, satinalma və s.) sürətli
 * fail-closed qorumadır — icazə kataloqundakı real kodlarla çağırılmalıdır.
 */
export function ensurePermission(...perms: string[]): void {
  const ctx = requireTenant();
  if (ctx.rolAd === "admin" || ctx.rolAd === "sahibkar") return;
  if (perms.length === 0) return;
  if (perms.some((p) => ctx.icazeler.includes(p))) return;
  throw new Error(`Bu əməliyyat üçün icazə yoxdur (${perms.join(" / ")})`);
}

/** QA-audit: yalnız sahibkar (owner) icra edə bilər — owner-private action-lar üçün. THROW-lu. */
export function ensureOwner(): void {
  const ctx = requireTenant();
  if (ctx.rolAd !== "sahibkar") {
    throw new Error("Bu əməliyyat yalnız biznes sahibinə (owner) icazəlidir");
  }
}

/**
 * QA-audit (professional): ensurePermission-un RETURN variantı — throw əvəzinə {ok,error} qaytarır ki,
 * bloklanmış istifadəçi generic 500 yox, təmiz "icazə yoxdur" mesajı görsün. İstifadə:
 *   const g = permGate("qiymet.idare"); if (!g.ok) return g;
 */
export function permGate(...perms: string[]): { ok: true } | { ok: false; error: string } {
  const ctx = requireTenant();
  if (ctx.rolAd === "admin" || ctx.rolAd === "sahibkar") return { ok: true };
  if (perms.length === 0) return { ok: true };
  if (perms.some((p) => ctx.icazeler.includes(p))) return { ok: true };
  return { ok: false, error: `Bu əməliyyat üçün icazə yoxdur (${perms.join(" / ")})` };
}

/** QA-audit: ensureOwner-in RETURN variantı — təmiz mesajla. */
export function ownerGate(): { ok: true } | { ok: false; error: string } {
  const ctx = requireTenant();
  if (ctx.rolAd !== "sahibkar") {
    return { ok: false, error: "Bu əməliyyat yalnız biznes sahibinə (owner) icazəlidir" };
  }
  return { ok: true };
}
