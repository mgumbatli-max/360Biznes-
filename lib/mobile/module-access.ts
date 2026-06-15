import "server-only";

import { getTenantDisabledModules } from "@/lib/auth/module-gate";

/**
 * Mobil API üçün MODUL-entitlement yoxlaması (web route-gate ilə paritet).
 *
 * Tenant-ın bağlı (deaktiv / demosu bitmiş) modul dəstini `getTenantDisabledModules`
 * ilə yükləyir və verilən `modulKod` orada DEYİLSƏ `true` (icazə var) qaytarır.
 *
 * FAIL-OPEN: entitlement sorğusu səhv versə (DB problemi və s.) API-ni kilidləmirik —
 * `true` qaytarılır ki, login/data axını qırılmasın. Bloklama yalnız bağlı modul
 * AÇIQ-AŞKAR təsbit olunduqda baş verir.
 *
 * @returns icazə varsa `true`, modul tenant üçün bağlıdırsa `false`.
 */
export async function assertModuleAccess(
  sahibkarId: string,
  modulKod: string,
): Promise<boolean> {
  try {
    const disabled = await getTenantDisabledModules(sahibkarId);
    return !disabled.has(modulKod);
  } catch {
    // FAIL-OPEN — entitlement yoxlaması heç vaxt API-ni qırmamalıdır.
    return true;
  }
}
