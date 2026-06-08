import "server-only";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";

/**
 * Maya görmə icazəsi — adi satışçı/anbar işçisi məhsul mayasını görməməlidir.
 * Yalnız:
 *  - sahibkar/owner/admin/direktor/muhasib rolları
 *  - və ya `qiymet.oxu`, `qiymet.idare`, `maliye.view`, `maya.gor` icazələri
 * görür.
 */
const PRIVILEGED_ROLES = /sahibkar|owner|admin|direktor|muhasib/i;

export async function canViewCost(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  if (PRIVILEGED_ROLES.test(session.user.rol_ad ?? "")) return true;
  const icazeler = await getRequestPermissions();
  return (
    icazeler.includes("qiymet.oxu") ||
    icazeler.includes("qiymet.idare") ||
    icazeler.includes("maliye.view") ||
    icazeler.includes("maya.gor")
  );
}

/**
 * Mənfəət/marja görmə icazəsi — adi işçi satış üzərində mənfəəti görə bilməz.
 * Maliyyə hesabatları, P&L, dashboard mənfəət widgetləri bu helperi
 * istifadə etməlidir. Maya görə bilməyən mənfəəti də görə bilməz.
 */
export async function canViewProfit(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  if (PRIVILEGED_ROLES.test(session.user.rol_ad ?? "")) return true;
  const icazeler = await getRequestPermissions();
  return (
    icazeler.includes("maliye.view") ||
    icazeler.includes("maliyye.idare") ||
    icazeler.includes("menfeet.gor") ||
    icazeler.includes("hesabat.maliye")
  );
}

/**
 * Sahibkar pulu / dividend / gizli maliyyə əməliyyatları görmə icazəsi —
 * yalnız owner səviyyəsi.
 */
export async function canViewOwnerFinance(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  const rolAd = session.user.rol_ad ?? "";
  return /sahibkar|owner/i.test(rolAd);
}
