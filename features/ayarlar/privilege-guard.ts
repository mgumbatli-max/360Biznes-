import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { isAyarPrivileged } from "./access-guard";

/**
 * İMTİYAZ QALDIRMA (privilege escalation) MÜDAFİƏSİ — icazə-məzmunu əsaslı.
 *
 * Modulun ad-əsaslı privilege modeli (`isAyarPrivileged`, RESERVED_ROLE_NAME)
 * tək başına yetərli deyildi: `rol.idare` icazəli imtiyazsız istifadəçi zərərsiz
 * adlı custom rola BÜTÜN kataloqu yığıb (saveRolePerms/cloneRole) sonra onu
 * istifadəçilərə təyin edərək (createUser/changeUserRole) faktiki tam-admin
 * ola bilirdi. Bu helper həmin sinfi icazə KODLARI səviyyəsində bağlayır.
 *
 * İki qayda:
 *  A) Həssas-kod qapısı — imtiyazsız aktor SENSITIVE_PERM_CODES-dan heç birini
 *     nə rola verə, nə də bu kodları daşıyan rolu təyin edə bilər.
 *  B) No-amplification — imtiyazsız aktor yalnız ÖZ daşıdığı icazələri verə/təyin
 *     edə bilər (öz səviyyəsindən yuxarı icazə mint edə bilməz).
 *
 * İmtiyazlı aktor (sahibkar/admin/owner/direktor) hər ikisindən azaddır — yeni
 * qeydiyyatdan keçən sahibkar `getRequestPermissions()`-dən bütün kodları alır,
 * ona görə heç bir məhdudiyyət hiss etmir.
 */

/** Admin-ekvivalent güc verən icazə kodları (mövcud olmayanlar sadəcə uyğun gəlmir). */
export const SENSITIVE_PERM_CODES: readonly string[] = [
  "ayar.idare",
  "ayar.rol_idare",
  "ayar.api_key",
  "ayar.backup",
  "ayar.abune",
  "ayar.tehlukesizlik",
  "istifadeci.idare",
  "istifadeci.reset_password",
  "rol.idare",
  "audit.view",
  "sahibkar.access",
  "platform.admin",
  "maliyye.idare",
  "maliyye.hesab_idare",
];

const SENSITIVE_SET = new Set<string>(SENSITIVE_PERM_CODES);

export function isSensitivePermCode(kod: string | null | undefined): boolean {
  return !!kod && SENSITIVE_SET.has(kod);
}

export type ActorPrivilege = { privileged: boolean; codes: Set<string> };

/**
 * Aktorun imtiyaz konteksti — bir dəfə yüklə, action boyu təkrar işlət.
 * `getRequestPermissions()` React `cache()`-lidir, ona görə ucuzdur.
 * withTenant-dən ƏVVƏL və ya SONRA çağrıla bilər (auth-a əsaslanır).
 */
export async function getActorPrivilege(): Promise<ActorPrivilege> {
  const session = await auth();
  const privileged = isAyarPrivileged(session?.user?.rol_ad);
  const codes = new Set<string>(await getRequestPermissions());
  return { privileged, codes };
}

/**
 * Qayda A+B: verilən icaze_id-lərin heç biri aktorun səviyyəsindən yuxarı
 * olmamalıdır. İmtiyazlı aktor → həmişə OK.
 * @returns null = OK; əks halda blok səbəbini bildirən mətn.
 */
export async function checkGrantablePermIds(
  icazeIds: number[],
  actor: ActorPrivilege,
): Promise<string | null> {
  if (actor.privileged || icazeIds.length === 0) return null;
  const rows = await prisma.icazeler.findMany({
    where: { id: { in: icazeIds } },
    select: { kod: true },
  });
  for (const row of rows) {
    const kod = row.kod ?? "";
    if (isSensitivePermCode(kod)) {
      return "Həssas (imtiyazlı) icazələri yalnız sahibkar/admin verə bilər";
    }
    if (!actor.codes.has(kod)) {
      return "Özünüzdə olmayan icazəni başqa rola verə bilməzsiniz";
    }
  }
  return null;
}

/**
 * Rol təyini (createUser / changeUserRole / resetUserPassword / deleteUser)
 * üçün eskalasiya yoxlaması. İmtiyazsız aktor:
 *  - ad-əsaslı imtiyazlı (sahibkar/admin/owner/direktor) rolu,
 *  - həssas kod daşıyan rolu,
 *  - öz səviyyəsindən yuxarı icazəli rolu
 * təyin edə/bu rolun sahibinə toxuna bilməz.
 * @returns null = OK; əks halda blok səbəbi.
 */
export async function checkAssignableRole(
  rolId: number,
  rolAd: string | null | undefined,
  actor: ActorPrivilege,
): Promise<string | null> {
  if (actor.privileged) return null;
  if (isAyarPrivileged(rolAd)) {
    return "İcazə səviyyənizdən yuxarı rol təyin edə bilməzsiniz";
  }
  const permRows = await prisma.rol_icazeleri.findMany({
    where: { rol_id: rolId },
    select: { icaze_id: true },
  });
  const ids = permRows.map((p) => p.icaze_id);
  if (ids.length === 0) return null;
  const rows = await prisma.icazeler.findMany({
    where: { id: { in: ids } },
    select: { kod: true },
  });
  for (const row of rows) {
    if (isSensitivePermCode(row.kod)) {
      return "Bu rol imtiyazlı icazələr daşıyır — təyin etmək səlahiyyətiniz çatmır";
    }
    if (row.kod && !actor.codes.has(row.kod)) {
      return "Bu rol sizin icazə səviyyənizdən yuxarıdır";
    }
  }
  return null;
}
