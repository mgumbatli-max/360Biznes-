import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";

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
