import "server-only";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Ayarlar modulu üçün icaze + cache helper-ləri.
 *
 * Bu modul ADMIN-yalnızdır. Default-da sahibkar/admin/owner/direktor keçir.
 * Spesifik action-lar üçün əlavə icazə tələb edilir.
 *
 * İcazə kodları (gələcəkdə migration):
 *   - ayar.view       — settings səhifələri oxu
 *   - ayar.idare      — settings yenilə (default)
 *   - ayar.rol_idare  — rol/icaze idarə
 *   - ayar.api_key    — API key generate/revoke
 *   - ayar.backup     — backup yarat/restore
 *   - ayar.abune      — subscription plan dəyiş
 *   - ayar.kanal      — telegram/email/inteqrasiya
 *   - ayar.qiymet     — qiymət formulaları, POS qiymət
 */
export type AyarPerm =
  | "ayar.view"
  | "ayar.idare"
  | "ayar.rol_idare"
  | "ayar.api_key"
  | "ayar.backup"
  | "ayar.abune"
  | "ayar.kanal"
  | "ayar.qiymet"
  // Rollarda faktiki təyin olunan (seed edilmiş) açarlar — guard ayar.* ilə yanaşı bunları da qəbul edir (#5).
  | "istifadeci.idare"
  | "rol.idare";

export function isAyarPrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("admin") || r.includes("owner") || r.includes("direktor");
}

/**
 * Yalnız sahibkar/admin/owner keçir — page guard.
 */
export async function requireAyarOwner(): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/giris");
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (!isAyarPrivileged(rolAd)) {
    redirect("/icaze-yox?kod=ayar.idare&from=ayarlar");
  }
}

/**
 * Action-level icaze yoxlaması. Sahibkar/admin/owner avtomatik keçir.
 */
export async function requireAyarActionPerm(perm: AyarPerm | AyarPerm[] = "ayar.idare"): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isAyarPrivileged(rolAd)) return { ok: true };
  const icazeler = await getRequestPermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (perms.some((p) => icazeler.includes(p))) return { ok: true };
  return { ok: false, error: `Bu əməliyyat üçün «${perms.join("» / «")}» icazələrindən biri lazımdır` };
}

export function bustAyarCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`ayar:${sahibkarId}`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max");
  } catch {
    // tenant context yox — TTL tutacaq
  }
}
