import "server-only";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Kampaniyalar modulu üçün icaze + cache helper-ləri.
 *
 * İcazə kodları (scripts/migrations/2026-06-02-kampaniya-permissions.sql):
 *   - kampaniya.oxu     — kampaniya/kupon/loyalty siyahısı oxu
 *   - kampaniya.idare   — kampaniya yarat/redaktə/status
 *   - kampaniya.sil     — kampaniya arxiv (soft delete)
 *   - kampaniya.kupon   — kupon yarat / bulk
 *   - marketing.broadcast — Telegram/SMS broadcast
 *   - loyalty.idare     — loyalty kart yarat, tier yenilə
 *   - loyalty.balans    — bonus balans manual artır/azalt (💰 maliyyə!)
 *   - gift.yarat        — hədiyyə kartı yarat
 *   - gift.idare        — hədiyyə kartı təyin et / söndür
 *
 * Sahibkar/admin/owner avtomatik keçir.
 */
export type KampaniyaPerm =
  | "kampaniya.oxu"
  | "kampaniya.idare"
  | "kampaniya.sil"
  | "kampaniya.kupon"
  | "marketing.broadcast"
  | "loyalty.idare"
  | "loyalty.balans"
  | "gift.yarat"
  | "gift.idare";

export function isKampaniyaPrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("admin") || r.includes("owner") || r.includes("direktor");
}

/**
 * Server-action səviyyəsində icaze yoxlaması.
 * Sahibkar/admin/owner avtomatik keçir.
 */
export async function requireKampaniyaActionPerm(
  perm: KampaniyaPerm | KampaniyaPerm[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isKampaniyaPrivileged(rolAd)) return { ok: true };
  const icazeler = await getRequestPermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (perms.some((p) => icazeler.includes(p))) return { ok: true };
  return { ok: false, error: `Bu əməliyyat üçün «${perms.join("» / «")}» icazələrindən biri lazımdır` };
}

/**
 * Kampaniya cache tag-larını birgə təzələ.
 */
export function bustKampaniyaCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`kampaniya:${sahibkarId}`, "max");
    revalidateTag(`ref:${sahibkarId}:loyalty`, "max");
  } catch {
    // tenant context yoxdur — TTL tutacaq
  }
}
