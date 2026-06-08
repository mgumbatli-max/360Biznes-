import "server-only";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * HR (Əməkdaşlar) modulu üçün icaze yoxlaması və cache helper-ləri.
 *
 * İcazə kodları (DB-də qeyd olunub, scripts/migrations/2026-06-02-hr-permissions.sql):
 *   - isci.view        — işçi siyahısını oxu
 *   - isci.idare       — işçi yarat/redaktə/deaktiv
 *   - isci.discipline  — cərimə, xəbərdarlıq, işdən çıxarma
 *   - maas.view        — maaş + bank məlumatları oxu (özü xaric)
 *   - maas.idare       — payroll hesabla, ödə, bonus/cərimə tətbiq et
 *   - maas.skala       — maaş bandları/skalası redaktə
 *   - davamiyyet.view  — davamiyyət oxu
 *   - davamiyyet.idare — başqasının davamiyyətini redaktə
 *   - mezuniyyet.istek — özü üçün məzuniyyət istəyi
 *   - mezuniyyet.tesdiq — başqasının məzuniyyət istəyini təsdiq/rədd
 *   - vakansiya.idare  — vakansiya yarat/sil, namizəd idarəetməsi
 *   - treninq.idare    — treninq şablonları + təyinatı
 *   - hr.documents     — sənəd əlavə/sil
 *   - hr.budce         — büdcə planı
 *   - hr.bonus_idare   — bonus profili / KPI formulu (yalnız sahibkar/HR direktor)
 *
 * Sahibkar/admin/owner/direktor avtomatik keçir.
 */

export type HrPerm =
  | "isci.view"
  | "isci.idare"
  | "isci.discipline"
  | "maas.view"
  | "maas.idare"
  | "maas.skala"
  | "davamiyyet.view"
  | "davamiyyet.idare"
  | "mezuniyyet.istek"
  | "mezuniyyet.tesdiq"
  | "vakansiya.idare"
  | "treninq.idare"
  | "hr.documents"
  | "hr.budce"
  | "hr.bonus_idare";

export function isHrPrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("admin") || r.includes("owner") || r.includes("direktor");
}

/**
 * Page-səviyyəsində HR icazə yoxlaması — yoxsa /icaze-yox-a redirect.
 */
export async function requireHrPagePerm(perm?: HrPerm) {
  const session = await auth();
  if (!session?.user) redirect("/giris");
  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isHrPrivileged(rolAd)) return { rolAd, icazeler, privileged: true };
  if (!icazeler.includes("isci.view") && !icazeler.includes("hr.view")) {
    redirect("/icaze-yox?kod=isci.view&from=iscilier");
  }
  if (perm && !icazeler.includes(perm)) {
    redirect(`/icaze-yox?kod=${encodeURIComponent(perm)}&from=iscilier`);
  }
  return { rolAd, icazeler, privileged: false };
}

/**
 * Server-action səviyyəsində HR icazə yoxlaması.
 * Tək perm ya da bir neçə perm-dən birini tələb edə bilərik.
 */
export async function requireHrActionPerm(perm: HrPerm | HrPerm[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isHrPrivileged(rolAd)) return { ok: true };
  const icazeler = await getRequestPermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (perms.some((p) => icazeler.includes(p))) return { ok: true };
  return { ok: false, error: `Bu əməliyyat üçün «${perms.join("» / «")}» icazələrindən biri lazımdır` };
}

/**
 * Cari istifadəçinin özüdürmü? Self-service üçün vacibdir.
 */
export async function isSelf(istifadeciId: string): Promise<boolean> {
  try {
    const { istifadeciId: currentId } = requireTenant();
    return istifadeciId === currentId;
  } catch {
    return false;
  }
}

/**
 * Maaş/PII field-lərini görə bilirmi? — özüdürsə bəli, ya da `maas.view`/`maas.idare`.
 */
export async function canViewSalary(targetIstifadeciId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isHrPrivileged(rolAd)) return true;
  if (session.user.id === targetIstifadeciId) return true;
  const icazeler = await getRequestPermissions();
  return icazeler.includes("maas.view") || icazeler.includes("maas.idare");
}

/**
 * HR modulunun cache tag-larını birgə təzələ.
 */
export function bustHrCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`iscilier:${sahibkarId}`, "max");
    revalidateTag(`ref:${sahibkarId}:iscilier`, "max");
  } catch {
    // tenant yoxdur — TTL tutacaq
  }
}

/**
 * PII field-lərini filter et — maaş, bank, FİN.
 * `T` obyekti modifikasiya edilir (deep copy etmir, performans üçün).
 */
export function redactPii<T extends Record<string, unknown>>(
  obj: T | null,
  canSee: boolean,
): T | null {
  if (!obj || canSee) return obj;
  // PII field-ləri gizli
  const PII_FIELDS = ["aylik_maas", "bank_ad", "bank_hesab", "fin_kod", "iban", "muqavile_meblegh"];
  const out = { ...obj } as Record<string, unknown>;
  for (const f of PII_FIELDS) {
    if (f in out) out[f] = null;
  }
  return out as T;
}
