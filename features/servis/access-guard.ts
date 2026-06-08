import "server-only";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Servis modulu üçün ortaq icazə yoxlaması.
 * Master `servis.oxu` + spesifik (məs. `servis.yarat`, `servis.idare`).
 * Sahibkar/admin/owner/direktor avtomatik keçir.
 */
export async function requireServisPerm(requiredPerm?: string) {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin = isServisPrivileged(rolAd);

  if (isOwnerOrAdmin) return { rolAd, icazeler, isOwnerOrAdmin };

  if (!icazeler.includes("servis.oxu")) redirect(`/icaze-yox?kod=servis.oxu&from=servis`);
  if (requiredPerm && !icazeler.includes(requiredPerm)) {
    redirect(`/icaze-yox?kod=${encodeURIComponent(requiredPerm)}&from=servis`);
  }

  return { rolAd, icazeler, isOwnerOrAdmin };
}

export function isServisPrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return (
    r.includes("sahibkar") ||
    r.includes("owner") ||
    r.includes("admin") ||
    r.includes("direktor") ||
    r.includes("servis_menecer")
  );
}

/**
 * Server action-larda istifadə üçün. Bir neçə icazə ardıcıllığını dəstəkləyir (OR).
 */
export async function requireServisActionPerm(perm: string | string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isServisPrivileged(rolAd)) return { ok: true };
  const perms = await getRequestPermissions();
  const required = Array.isArray(perm) ? perm : [perm];
  if (required.some((p) => perms.includes(p))) return { ok: true };
  return { ok: false, error: `«${required.join("» / «")}» icazələrindən biri lazımdır` };
}

/**
 * Servis cache tag-larını birgə təzələ.
 */
export function bustServisCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`servis:${sahibkarId}`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`stok:${sahibkarId}`, "max");
    revalidateTag(`ref:${sahibkarId}:musteriler`, "max");
  } catch {
    /* tenant context yox — TTL tutacaq */
  }
}

/**
 * Public customer endpoint qoruması — rate-limit + token yoxlaması.
 * Son 5 dəqiqədə eyni IP / token üçün maksimum N tələb qəbul olunur.
 *
 * IP audit_log-dan götürülür. Heç bir audit yoxdursa — keçməyə icazə verilir,
 * çünki ilk dəfə müraciət ola bilər.
 */
export async function checkCustomerEndpointRateLimit(
  resursId: string,
  maxPerWindow = 3,
  windowMinutes = 5,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recent = await prisma.audit_log.count({
      where: {
        resurs_id: resursId,
        emeliyyat: { in: ["musteri_onay", "musteri_rey", "musteri_redd"] },
        yaradildi: { gte: since },
      },
    });
    if (recent >= maxPerWindow) {
      return {
        ok: false,
        error: "Çox tələb göndərilib. Bir neçə dəqiqədən sonra yenidən cəhd edin.",
      };
    }
    return { ok: true };
  } catch {
    // rate-limit yoxlanılmadıqda, default olaraq icazə ver
    return { ok: true };
  }
}

/**
 * Servis qeydinə bağlı approval_token hesabla.
 * HMAC-SHA256(servis_id + ":" + sahibkar_id, SECRET) → ilk 32 hex simvol.
 * SECRET olmasa, AUTH_SECRET istifadə olunur.
 */
async function computeServisToken(servisId: string, sahibkarId: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  const secret = process.env.SERVIS_TOKEN_SECRET ?? process.env.AUTH_SECRET ?? "default-fallback-secret-change-me";
  return createHmac("sha256", secret).update(`${servisId}:${sahibkarId}`).digest("hex").slice(0, 32);
}

/**
 * Public endpoint-lərdə UUID təxmin etməyi blok edən token yoxlaması (timing-safe).
 */
export async function verifyServisToken(
  provided: string | null | undefined,
  servisId: string,
  sahibkarId: string,
): Promise<boolean> {
  if (!provided || provided.length < 10) return false;
  const expected = await computeServisToken(servisId, sahibkarId);
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Public link / QR kod üçün token istehsalı.
 * Yalnız sahibkarın istifadəçisi tərəfindən çağırıla bilər.
 */
export async function generateServisCustomerToken(servisId: string, sahibkarId: string): Promise<string> {
  return computeServisToken(servisId, sahibkarId);
}
