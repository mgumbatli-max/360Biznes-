/**
 * Tam-giriş (privileged) rol yoxlaması — client-safe, saf funksiya.
 *
 * Sahibkar / admin / owner rolları icazə kataloqundan ASILI OLMADAN bütün
 * tenant funksionallığına çıxış əldə edir. Bu, server guard-larının
 * (`requireAnbarActionPerm`, `gateRoute`, `mobilePerm`, `canSeeNavItem`)
 * davranışı ilə eynidir — beləliklə client UI gate-ləri owner-i heç vaxt
 * kataloqda olmayan/yenidən adlandırılmış kod üzündən kilidləməsin.
 *
 * QEYD: super-admin / platform-admin BURADAN VERİLMİR — o, ayrıca email
 * allowlist + `SUPER_ADMIN_SAHIBKAR_ID` ilə müəyyən olunur (lib/platform-admin/guard).
 */
export function isPrivilegedRole(rolAd?: string | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("admin") || r.includes("owner");
}
