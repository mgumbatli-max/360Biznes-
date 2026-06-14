import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { SessionUser } from "@/lib/auth/types";

/**
 * Super-admin email allowlist — YALNIZ env-dən (`SUPER_ADMIN_EMAILS`, vergüllə).
 * ⚠️ Məxfilik: heç bir email/identifikator kodda (və git tarixçəsində) saxlanmır;
 * dəyər yalnız Vercel mühit dəyişəni kimi qoyulur.
 */
function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Email super-admin allowlist-dədir? — YALNIZ identifikator kimi, tək başına
 * səlahiyyət VERMİR (aşağıdakı `isSuperAdmin`-ə bax). Rezerv emaillərin başqa
 * tenantda yaradılmasını bloklamaq üçün də istifadə olunur (defense-in-depth).
 */
export function isReservedSuperAdminEmail(email?: string | null): boolean {
  return !!email && superAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * İcazəli platforma-sahibi tenantı (sahibkar_id). Email allowlist YALNIZ bu
 * tenant daxilində super-admin verir. Vercel env: `SUPER_ADMIN_SAHIBKAR_ID`.
 */
function authorizedTenantId(): string | null {
  return (process.env.SUPER_ADMIN_SAHIBKAR_ID ?? "").trim() || null;
}

/**
 * Platform super-admin icazəsi var? — super-admin EKSKLÜZİV olaraq KONKRET
 * profilə bağlıdır, HEÇ BİR rolla (rol_id=1 daxil) verilə bilməz:
 *   email allowlist-dədir **VƏ** sahibkar_id icazəli platforma-sahibi
 *   tenantına bərabərdir (`SUPER_ADMIN_SAHIBKAR_ID`).
 *
 * ⚠️ Niyə rol yox / niyə təkcə email yox:
 *  - Rol-əsaslı super-admin (rol_id===1) qəsdən SİLİNİB: əks halda istənilən
 *    sahibkar istifadəçiyə həmin rolu verib platformaya çıxa bilərdi.
 *  - Email multi-tenant-də unikal deyil (`@@unique([sahibkar_id, email])`).
 *    Təkcə email-ə güvənsək, başqa sahibkar həmin emaillı user yaradıb
 *    super-admin olardı. `sahibkar_id` bağlaması bunu bağlayır.
 * Nəticədə super-admin = YALNIZ bir konkret hesab (platforma sahibinin profili).
 * `SUPER_ADMIN_SAHIBKAR_ID` env qoyulmayıbsa HEÇ KİM super-admin deyil (fail-closed).
 */
export function isSuperAdmin(
  user?: Pick<SessionUser, "email" | "sahibkar_id"> | null
): boolean {
  if (!user) return false;
  const tenant = authorizedTenantId();
  if (!tenant) return false;
  return user.sahibkar_id === tenant && isReservedSuperAdminEmail(user.email);
}

/**
 * Platform-admin guard. `/platform-admin/*` server komponentlərinin başında çağır.
 * Yalnız super-admin (rol_id=1 və ya allowlist email) keçir.
 */
export async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isSuperAdmin(session.user)) redirect("/dashboard");
  return session.user;
}
