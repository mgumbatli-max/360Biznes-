import "server-only";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Team / Söhbət modulu üçün icaze + kanal admin yoxlamaları.
 *
 * İcazə kodları (scripts/migrations/2026-06-02-team-permissions.sql):
 *   - team.kanal_yarat — yeni kanal yarat
 *   - team.idare       — təşkilat səviyyəli team ayarları
 *   - team.broadcast   — bütün kanal üzvlərinə bildiriş push (gələcəkdə)
 *
 * Sahibkar/admin/owner avtomatik keçir.
 */
export type TeamPerm = "team.kanal_yarat" | "team.idare" | "team.broadcast";

export function isTeamPrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("admin") || r.includes("owner") || r.includes("direktor");
}

/**
 * Org-səviyyəli icaze yoxlaması (sahibkar/admin yalnız).
 */
export async function requireTeamOrgAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isTeamPrivileged(rolAd)) return { ok: true };
  const icazeler = await getRequestPermissions();
  if (icazeler.includes("team.idare")) return { ok: true };
  return { ok: false, error: "Bu əməliyyat üçün «team.idare» icazəsi və ya sahibkar/admin rolu lazımdır" };
}

/**
 * Standart server-action icaze yoxlaması.
 */
export async function requireTeamActionPerm(perm: TeamPerm | TeamPerm[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isTeamPrivileged(rolAd)) return { ok: true };
  const icazeler = await getRequestPermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (perms.some((p) => icazeler.includes(p))) return { ok: true };
  return { ok: false, error: `Bu əməliyyat üçün «${perms.join("» / «")}» icazələrindən biri lazımdır` };
}

/**
 * Cari istifadəçi kanalın üzvüdürmü? — gizli/kilidli mesaj görmək üçün lazım.
 */
export async function isChannelMember(kanalId: number, istifadeciId?: string): Promise<boolean> {
  try {
    const uid = istifadeciId ?? requireTenant().istifadeciId;
    if (!uid) return false;
    const m = await prisma.team_uzv.findUnique({
      where: { kanal_id_istifadeci_id: { kanal_id: kanalId, istifadeci_id: uid } },
      select: { id: true },
    });
    return !!m;
  } catch {
    return false;
  }
}

/**
 * Cari istifadəçi kanalın admin-idir? — üzv əlavə/sil, arxiv üçün lazım.
 * Sahibkar/admin avtomatik keçir.
 */
export async function isChannelAdmin(kanalId: number, istifadeciId?: string): Promise<boolean> {
  try {
    const session = await auth();
    const rolAd = (session?.user?.rol_ad ?? "").toLowerCase();
    if (isTeamPrivileged(rolAd)) return true;
    const uid = istifadeciId ?? requireTenant().istifadeciId;
    if (!uid) return false;
    const m = await prisma.team_uzv.findUnique({
      where: { kanal_id_istifadeci_id: { kanal_id: kanalId, istifadeci_id: uid } },
      select: { rolu: true },
    });
    return m?.rolu === "admin";
  } catch {
    return false;
  }
}

/**
 * Cari istifadəçi kanalın üzvü deyilsə icazə xətası qaytar.
 */
export async function requireChannelMember(kanalId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const isMember = await isChannelMember(kanalId);
  if (!isMember) return { ok: false, error: "Bu kanala üzv deyilsiniz" };
  return { ok: true };
}

/**
 * Cari istifadəçi kanalın admin-i deyilsə icazə xətası qaytar.
 */
export async function requireChannelAdmin(kanalId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const isAdmin = await isChannelAdmin(kanalId);
  if (!isAdmin) return { ok: false, error: "Bu kanalın admin-i olmalısınız" };
  return { ok: true };
}

/**
 * Team cache tag-larını birgə təzələ.
 */
export function bustTeamCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`team:${sahibkarId}`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
  } catch {
    // tenant context yox — TTL tutacaq
  }
}

/**
 * Kanal üçün bildiriş alacaq üzvlərin id-lərini qaytar (mention + bütün üzvlər).
 */
export async function getChannelNotifyTargets(
  kanalId: number,
  excludeUserId: string,
  mentionIds: string[] = [],
): Promise<{ all: string[]; mentions: string[] }> {
  try {
    const members = await prisma.team_uzv.findMany({
      where: { kanal_id: kanalId, bildiris: true },
      select: { istifadeci_id: true },
    });
    const all = members
      .map((m) => m.istifadeci_id)
      .filter((id) => id !== excludeUserId);
    const memberSet = new Set(all);
    const mentions = mentionIds.filter((id) => memberSet.has(id));
    return { all, mentions };
  } catch {
    return { all: [], mentions: [] };
  }
}
