import "server-only";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { auth } from "@/auth";

/**
 * Real-time tarix məcburiyyəti — bütün satış/alış/ödəniş/xərc əməliyyatları
 * üçün universal guard.
 *
 *  - Default davranış: tarix bu günə bərabər olmalıdır (gün dəqiqliyi ilə).
 *  - `tarix.geri` icazəsi olanlar köhnə tarix daxil edə bilər.
 *  - Sahibkar/admin/owner rolları icazə kodundan asılı olmadan keçir.
 *  - Gələcək tarix HEÇ KİM tərəfindən daxil edilə bilməz — backdate yox,
 *    forward date həmişə bug deməkdir.
 *
 * İstifadə (server action içində, withTenant blokundan əvvəl):
 *
 *   const dateCheck = await validateOperationDate(input.tarix);
 *   if (!dateCheck.ok) return { ok: false, error: dateCheck.error };
 *
 * Audit-də qeyd üçün `dateCheck.isBackdated` və `dateCheck.daysAgo`
 * istifadə edilə bilər.
 */

type ValidateResult =
  | { ok: true; isBackdated: false; daysAgo: 0; parsedDate: Date }
  | { ok: true; isBackdated: true; daysAgo: number; parsedDate: Date }
  | { ok: false; error: string };

const MAX_FUTURE_MINUTES = 2; // server clock skew tolerance

function isPrivilegedRole(rolAd: string | null | undefined): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("admin") || r.includes("owner");
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Tarixi yoxla. `input` ya ISO string, ya Date, ya undefined ola bilər.
 * undefined → bu gün hesab olunur (heç bir guard tətbiq edilmir).
 */
export async function validateOperationDate(
  input: string | Date | null | undefined,
  options: {
    /** Maks neçə gün geri tarix qəbul olunsun (icazə olsa belə). Default: 365 */
    maxBackdateDays?: number;
    /** UI-da "tarix" sahəsinin etiketi — xəta mesajı üçün */
    fieldLabel?: string;
  } = {},
): Promise<ValidateResult> {
  // Boş tarix → bu gün — guard yox, heç bir səhv
  if (!input) {
    return { ok: true, isBackdated: false, daysAgo: 0, parsedDate: new Date() };
  }

  const parsed = input instanceof Date ? input : new Date(input);
  if (isNaN(parsed.getTime())) {
    return { ok: false, error: "Tarix formatı yanlışdır" };
  }

  const now = new Date();
  const futureSkewMs = MAX_FUTURE_MINUTES * 60 * 1000;
  if (parsed.getTime() > now.getTime() + futureSkewMs) {
    return {
      ok: false,
      error: `${options.fieldLabel ?? "Tarix"} gələcəkdə ola bilməz`,
    };
  }

  // Gün dəqiqliyi ilə müqayisə — eyni gün → backdate sayılmaz
  const today = startOfDay(now);
  const inputDay = startOfDay(parsed);
  const diffMs = today.getTime() - inputDay.getTime();
  const daysAgo = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

  if (daysAgo === 0) {
    return { ok: true, isBackdated: false, daysAgo: 0, parsedDate: parsed };
  }

  // Backdate — icazə yoxla
  const maxBackdate = options.maxBackdateDays ?? 365;
  if (daysAgo > maxBackdate) {
    return {
      ok: false,
      error: `${options.fieldLabel ?? "Tarix"} ${maxBackdate} gündən köhnə ola bilməz`,
    };
  }

  const session = await auth();
  const rolAd = session?.user?.rol_ad;
  if (isPrivilegedRole(rolAd)) {
    return { ok: true, isBackdated: true, daysAgo, parsedDate: parsed };
  }

  const perms = await getRequestPermissions();
  if (!perms.includes("tarix.geri")) {
    return {
      ok: false,
      error: `Köhnə tarixlə əməliyyat üçün «tarix.geri» icazəsi tələb olunur (${daysAgo} gün əvvəl)`,
    };
  }

  return { ok: true, isBackdated: true, daysAgo, parsedDate: parsed };
}

/** Audit yeni_data-ya əlavə üçün backdate metadata */
export function backdateAuditFields(check: Extract<ValidateResult, { ok: true }>) {
  if (!check.isBackdated) return {};
  return {
    backdated: true,
    backdated_days: check.daysAgo,
  };
}
