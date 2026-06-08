import "server-only";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Ticarət modulu üçün ortaq icazə yoxlaması.
 * Master `ticaret.oxu` + spesifik icazə (məs. `satis.yarat`).
 * Sahibkar/admin/owner avtomatik keçir.
 */
export async function requireTicaretPerm(requiredPerm?: string): Promise<{ rolAd: string; icazeler: string[]; isOwnerOrAdmin: boolean }> {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin =
    rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin");

  if (isOwnerOrAdmin) return { rolAd, icazeler, isOwnerOrAdmin };

  if (!icazeler.includes("ticaret.oxu")) redirect(`/icaze-yox?kod=ticaret.oxu&from=ticaret`);
  if (requiredPerm && !icazeler.includes(requiredPerm)) {
    redirect(`/icaze-yox?kod=${encodeURIComponent(requiredPerm)}&from=ticaret`);
  }

  return { rolAd, icazeler, isOwnerOrAdmin };
}

export function isTicaretPrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("owner") || r.includes("admin") || r.includes("direktor");
}

/**
 * Server action-larda istifadə üçün. Bir neçə icazə ardıcıllığını dəstəkləyir.
 */
export async function requireTicaretActionPerm(perm: string | string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isTicaretPrivileged(rolAd)) return { ok: true };
  const perms = await getRequestPermissions();
  const required = Array.isArray(perm) ? perm : [perm];
  if (required.some((p) => perms.includes(p))) return { ok: true };
  return { ok: false, error: `«${required.join("» / «")}» icazələrindən biri lazımdır` };
}

/**
 * Ticarət cache tag-larını birgə təzələ.
 */
export function bustTicaretCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`ticaret:${sahibkarId}`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`stok:${sahibkarId}`, "max");
    revalidateTag(`ref:${sahibkarId}:musteriler`, "max");
  } catch {
    // tenant context yox — TTL tutacaq
  }
}
