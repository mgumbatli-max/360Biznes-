import "server-only";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * 360 LAB modulu üçün icaze + cache helper-ləri.
 *
 * İcazə kodları (scripts/migrations/2026-06-02-lab-permissions.sql):
 *   - lab.view   — Lab kataloqu oxu + feature aktivləşdirmə (öz hesabında)
 *   - lab.idare  — Sahibkar səviyyəsində whitelist (hansı feature-lar açıq)
 *   - lab.rate   — Feature-ə rating/comment vermə
 *
 * Sahibkar/admin/owner avtomatik keçir.
 */
export type LabPerm = "lab.view" | "lab.idare" | "lab.rate";

export function isLabPrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("admin") || r.includes("owner") || r.includes("direktor");
}

export async function requireLabActionPerm(perm: LabPerm | LabPerm[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isLabPrivileged(rolAd)) return { ok: true };
  const icazeler = await getRequestPermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (perms.some((p) => icazeler.includes(p))) return { ok: true };
  return { ok: false, error: `Bu əməliyyat üçün «${perms.join("» / «")}» icazələrindən biri lazımdır` };
}

export function bustLabCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`lab:${sahibkarId}`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max");
  } catch {
    // tenant context yox — TTL tutacaq
  }
}
