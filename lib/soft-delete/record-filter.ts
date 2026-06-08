import "server-only";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";

/**
 * SİSTEM-MİQYASLI SOFT-DELETE STANDARTI
 *
 * Bütün modullar üçün vahid "Aktiv / Silinmiş / Hamısı" filter məntiqi.
 *
 * Cədvəllərdə standart sütunlar:
 *   - deleted_at  TIMESTAMP NULL  → NULL = aktiv, NOT NULL = silinmiş
 *   - deleted_by  UUID NULL       → kim silib
 *   - delete_reason TEXT NULL     → niyə silib
 *
 * Legacy: bəzi cədvəllərdə `status = 'legv'` istifadə olunur — backfill ilə
 * deleted_at sinxronlaşdırılır.
 */

export type RecordStatusFilter = "aktiv" | "silinmis" | "hamisi";

/**
 * URL search-params-dan filter dəyəri oxu. Default "aktiv".
 * İcazəsiz istifadəçi "silinmis" və ya "hamisi" göndərirsə, "aktiv"-ə downgrade.
 */
export async function readRecordStatusFromSearch(
  searchParams: Record<string, string | string[] | undefined>,
  paramName: string = "status_filter",
): Promise<{ filter: RecordStatusFilter; canSeeDeleted: boolean }> {
  const canSeeDeleted = await canViewDeletedRecords();
  const raw = (Array.isArray(searchParams[paramName])
    ? searchParams[paramName]?.[0]
    : searchParams[paramName]) as string | undefined;
  const requested: RecordStatusFilter =
    raw === "silinmis" ? "silinmis" : raw === "hamisi" ? "hamisi" : "aktiv";
  // Backend gate — icazəsi olmayan istifadəçi URL ilə də keçə bilməz.
  const filter: RecordStatusFilter = canSeeDeleted ? requested : "aktiv";
  return { filter, canSeeDeleted };
}

/**
 * `qeyd.silinmis.gor` icazəsi yoxlaması.
 * Sahibkar/admin/owner avtomatik keçir.
 */
export async function canViewDeletedRecords(): Promise<boolean> {
  const session = await auth();
  const rolAd = (session?.user?.rol_ad ?? "").toLowerCase();
  if (rolAd.includes("sahibkar") || rolAd.includes("admin") || rolAd.includes("owner")) {
    return true;
  }
  const perms = await getRequestPermissions();
  return perms.includes("qeyd.silinmis.gor");
}

/**
 * `qeyd.berpa` icazəsi.
 */
export async function canRestoreRecords(): Promise<boolean> {
  const session = await auth();
  const rolAd = (session?.user?.rol_ad ?? "").toLowerCase();
  if (rolAd.includes("sahibkar") || rolAd.includes("admin") || rolAd.includes("owner")) {
    return true;
  }
  const perms = await getRequestPermissions();
  return perms.includes("qeyd.berpa");
}

/**
 * `qeyd.fiziki_sil` — yalnız sahibkar.
 */
export async function canHardDelete(): Promise<boolean> {
  const session = await auth();
  const rolAd = (session?.user?.rol_ad ?? "").toLowerCase();
  if (rolAd.includes("sahibkar") || rolAd.includes("owner")) return true;
  const perms = await getRequestPermissions();
  return perms.includes("qeyd.fiziki_sil");
}

/**
 * Prisma `where` filter — soft-delete uyğun.
 * Legacy `status = 'legv'` da nəzərə alınır.
 */
export function prismaSoftDeleteFilter(filter: RecordStatusFilter) {
  switch (filter) {
    case "aktiv":
      return {
        deleted_at: null,
        // Legacy: status NOT IN ('legv', 'qaytarilib')
        // Modullara görə fərqlənə bilər — burada saxlamayaq, çağıran əlavə edir.
      };
    case "silinmis":
      return {
        deleted_at: { not: null },
      };
    case "hamisi":
      return {}; // heç bir filter
  }
}

/**
 * Raw SQL üçün WHERE fragment.
 * Çağıran prefix əlavə edir (məs. `s.` table alias).
 *
 * @example
 *   const sql = `SELECT * FROM satis_sifarisleri s WHERE ${rawSoftDeleteFilter(filter, "s")}`;
 */
export function rawSoftDeleteFilter(
  filter: RecordStatusFilter,
  tableAlias: string = "",
): string {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  switch (filter) {
    case "aktiv":
      return `${prefix}deleted_at IS NULL`;
    case "silinmis":
      return `${prefix}deleted_at IS NOT NULL`;
    case "hamisi":
      return "TRUE";
  }
}
