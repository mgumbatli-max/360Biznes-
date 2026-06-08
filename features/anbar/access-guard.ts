import "server-only";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Anbar səhifələri üçün ortaq icazə yoxlaması.
 * `requiredPerm` master `anbar.oxu`-ya əlavə tələb olunan spesifik icazə.
 * Sahibkar/admin/owner avtomatik keçir (icazə yoxdursa belə).
 *
 * Misal:
 *   await requireAnbarPerm("satinalma.oxu");  // /anbar/satinalma səhifəsi
 *   await requireAnbarPerm();                 // ana /anbar üçün yalnız master
 */
export async function requireAnbarPerm(requiredPerm?: string): Promise<{ rolAd: string; icazeler: string[]; isOwnerOrAdmin: boolean }> {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin =
    rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin");

  if (isOwnerOrAdmin) {
    return { rolAd, icazeler, isOwnerOrAdmin };
  }

  // Master icazə
  if (!icazeler.includes("anbar.oxu")) {
    redirect(`/icaze-yox?kod=anbar.oxu&from=anbar`);
  }
  // Spesifik icazə
  if (requiredPerm && !icazeler.includes(requiredPerm)) {
    redirect(`/icaze-yox?kod=${encodeURIComponent(requiredPerm)}&from=anbar`);
  }

  return { rolAd, icazeler, isOwnerOrAdmin };
}

export function isAnbarPrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("owner") || r.includes("admin") || r.includes("direktor");
}

/**
 * Server-action səviyyəli icaze yoxlaması.
 * Sahibkar/admin/owner avtomatik keçir.
 */
export async function requireAnbarActionPerm(perm: string | string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isAnbarPrivileged(rolAd)) return { ok: true };
  const icazeler = await getRequestPermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (perms.some((p) => icazeler.includes(p))) return { ok: true };
  return { ok: false, error: `Bu əməliyyat üçün «${perms.join("» / «")}» icazələrindən biri lazımdır` };
}

/**
 * Cari istifadəçi maya qiymətini görə bilərmi? — qiymet.oxu / qiymet.idare / privileged.
 */
export async function canViewCost(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isAnbarPrivileged(rolAd)) return true;
  const icazeler = await getRequestPermissions();
  return icazeler.includes("qiymet.oxu") || icazeler.includes("qiymet.idare") || icazeler.includes("maliye.view");
}

/**
 * `alish_qiymeti` (maya) field-ini redact et — qeyri-səlahiyyətli istifadəçilər üçün 0.
 */
export function redactCost<T extends { alish_qiymeti?: unknown }>(obj: T | null, canSee: boolean): T | null {
  if (!obj || canSee) return obj;
  if ("alish_qiymeti" in obj) {
    return { ...obj, alish_qiymeti: 0 };
  }
  return obj;
}

export function bustAnbarCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`anbar:${sahibkarId}`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`stok:${sahibkarId}`, "max");
    revalidateTag(`ref:${sahibkarId}:mehsullar`, "max");
  } catch {
    // tenant context yox — TTL tutacaq
  }
}

/**
 * Şəkil URL whitelist — yalnız https/http + bilinən provayderlər.
 */
const ALLOWED_IMAGE_HOSTS = new Set([
  "vercel-blob.com", "blob.vercel-storage.com",
  "amazonaws.com", "cloudfront.net",
  "imgur.com", "i.imgur.com",
  "cloudinary.com", "res.cloudinary.com",
]);

export function isValidImageUrl(url: string): boolean {
  if (!url) return true; // boş ok
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    // Allowlist: explicit OR endsWith allowed suffix
    if (ALLOWED_IMAGE_HOSTS.has(host)) return true;
    for (const allowed of ALLOWED_IMAGE_HOSTS) {
      if (host.endsWith("." + allowed)) return true;
    }
    // Tenant öz domeni (NEXT_PUBLIC_APP_URL)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      try {
        const appHost = new URL(appUrl).hostname.toLowerCase();
        if (host === appHost || host.endsWith("." + appHost)) return true;
      } catch { /* skip */ }
    }
    return false;
  } catch {
    return false;
  }
}
