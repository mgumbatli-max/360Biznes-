import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";

/**
 * Elaqə (CRM) modulu üçün ortaq icazə yoxlaması.
 * Master `elaqe.oxu` + spesifik (məs. `musteri.oxu`, `musteri.yarat`).
 * Sahibkar/admin/owner avtomatik keçir.
 */
export async function requireElaqePerm(requiredPerm?: string) {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin =
    rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin");

  if (isOwnerOrAdmin) return { rolAd, icazeler, isOwnerOrAdmin };

  if (!icazeler.includes("elaqe.oxu")) redirect(`/icaze-yox?kod=elaqe.oxu&from=elaqe`);
  if (requiredPerm && !icazeler.includes(requiredPerm)) {
    redirect(`/icaze-yox?kod=${encodeURIComponent(requiredPerm)}&from=elaqe`);
  }

  return { rolAd, icazeler, isOwnerOrAdmin };
}

export async function requireElaqeActionPerm(perm: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin")) {
    return { ok: true };
  }
  const perms = await getRequestPermissions();
  if (!perms.includes(perm)) return { ok: false, error: `«${perm}» icazəsi lazımdır` };
  return { ok: true };
}
