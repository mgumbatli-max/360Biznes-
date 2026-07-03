import "server-only";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatDecimal } from "@/lib/utils";

/**
 * Maliyyə modulu üçün ortaq icazə yoxlaması.
 * Master `maliyye.oxu` + spesifik (məs. `kassa.oxu`, `xerc.yarat`).
 * Sahibkar/admin/owner avtomatik keçir.
 */
export async function requireMaliyyePerm(requiredPerm?: string) {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin = isMaliyyePrivileged(rolAd);

  if (isOwnerOrAdmin) return { rolAd, icazeler, isOwnerOrAdmin };

  if (!icazeler.includes("maliyye.oxu")) redirect(`/icaze-yox?kod=maliyye.oxu&from=maliyye`);
  if (requiredPerm && !icazeler.includes(requiredPerm)) {
    redirect(`/icaze-yox?kod=${encodeURIComponent(requiredPerm)}&from=maliyye`);
  }

  return { rolAd, icazeler, isOwnerOrAdmin };
}

export function isMaliyyePrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return (
    r.includes("sahibkar") ||
    r.includes("owner") ||
    r.includes("admin") ||
    r.includes("direktor") ||
    r.includes("muhasib")
  );
}

/**
 * Server action-larda istifadə üçün. Bir neçə icazə ardıcıllığını dəstəkləyir (OR).
 */
export async function requireMaliyyeActionPerm(perm: string | string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isMaliyyePrivileged(rolAd)) return { ok: true };
  const perms = await getRequestPermissions();
  const required = Array.isArray(perm) ? perm : [perm];
  if (required.some((p) => perms.includes(p))) return { ok: true };
  return { ok: false, error: `«${required.join("» / «")}» icazələrindən biri lazımdır` };
}

/**
 * Maliyə cache tag-larını birgə təzələ.
 */
export function bustMaliyyeCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`maliyye:${sahibkarId}`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`kassa:${sahibkarId}`, "max");
    revalidateTag(`ref:${sahibkarId}:hesablar`, "max");
    revalidateTag(`ref:${sahibkarId}:musteriler`, "max");
  } catch {
    /* tenant context yox — TTL tutacaq */
  }
}

/**
 * Yüksək məbləğli əməliyyatlar üçün təsdiq tələbini yoxla.
 * Default: > 5000 AZN üçün admin/sahibkar/muhasib lazım.
 */
export async function requireHighValueApproval(meblegAzn: number, threshold = 5000): Promise<{ ok: true } | { ok: false; error: string }> {
  if (meblegAzn <= threshold) return { ok: true };
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isMaliyyePrivileged(rolAd)) return { ok: true };
  return {
    ok: false,
    error: `${formatDecimal(meblegAzn)} AZN — bu məbləğ üçün təsdiq tələb olunur (limit: ${threshold} AZN)`,
  };
}
