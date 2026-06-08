import "server-only";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * CRM / Mesaj Mərkəzi modulu üçün icaze + cache helper-ləri.
 *
 * İcazə kodları (scripts/migrations/2026-06-02-crm-permissions.sql):
 *   - crm.oxu          — CRM dashboard, inbox, lead siyahısı oxu
 *   - crm.idare        — CRM-də ümumi idarə
 *   - mesaj.cevab      — inbox söhbətə cavab göndər
 *   - mesaj.idare      — başqasının söhbətini görüntülə/redaktə (admin)
 *   - lead.yarat       — yeni lead yarat
 *   - lead.idare       — lead status dəyiş, mərhələ keçidi
 *   - lead.sil         — lead arxivlə
 *   - broadcast.idare  — toplu mesaj kampaniyası yarat/göndər
 *   - sablon.idare     — mesaj şablonu yarat/redaktə/sil
 *   - segment.idare    — müştəri seqmenti yarat/redaktə
 *   - ai.istifade      — AI cavab təklifi, AI seqment təklifi
 *
 * Sahibkar/admin/owner avtomatik keçir.
 */
export type CrmPerm =
  | "crm.oxu"
  | "crm.idare"
  | "mesaj.cevab"
  | "mesaj.idare"
  | "lead.yarat"
  | "lead.idare"
  | "lead.sil"
  | "broadcast.idare"
  | "sablon.idare"
  | "segment.idare"
  | "ai.istifade";

export function isCrmPrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("admin") || r.includes("owner") || r.includes("direktor");
}

/**
 * Server-action səviyyəsində icaze yoxlaması.
 * Sahibkar/admin/owner avtomatik keçir.
 */
export async function requireCrmActionPerm(perm: CrmPerm | CrmPerm[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isCrmPrivileged(rolAd)) return { ok: true };
  const icazeler = await getRequestPermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (perms.some((p) => icazeler.includes(p))) return { ok: true };
  return { ok: false, error: `Bu əməliyyat üçün «${perms.join("» / «")}» icazələrindən biri lazımdır` };
}

/**
 * Cari user-ə görə inbox/lead filtri qaytarır.
 * Adi user yalnız özünə təyin olunmuş söhbətləri və lead-ləri görür.
 * Privileged (sahibkar/admin) hər şeyi görür.
 */
export async function getCrmScopeFilter(): Promise<{
  privileged: boolean;
  istifadeciId: string | null;
}> {
  const session = await auth();
  if (!session?.user) return { privileged: false, istifadeciId: null };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const icazeler = await getRequestPermissions();
  const privileged = isCrmPrivileged(rolAd) || icazeler.includes("mesaj.idare") || icazeler.includes("crm.idare");
  return { privileged, istifadeciId: session.user.id };
}

/**
 * CRM cache tag-larını birgə təzələ.
 */
export function bustCrmCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`crm:${sahibkarId}`, "max");
    revalidateTag(`ref:${sahibkarId}:musteriler`, "max");
  } catch {
    // tenant context yoxdur — TTL tutacaq
  }
}

/**
 * Template placeholder-lərini təhlükəsiz şəkildə əvəz et.
 * - HTML special char-ları escape edilir
 * - Yalnız whitelist-də olan placeholder-lər icazə var
 */
const ALLOWED_PLACEHOLDERS = new Set([
  "musteri_ad",
  "ad",
  "telefon",
  "email",
  "tarix",
  "saat",
  "sirket",
  "kupon",
  "endirim",
  "borc",
  "balans",
]);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

export function applyTemplatePlaceholders(
  template: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, name: string) => {
    const key = name.toLowerCase();
    if (!ALLOWED_PLACEHOLDERS.has(key)) return ""; // bilinməyən placeholder silinir
    const val = values[key];
    if (val == null) return "";
    return escapeHtml(String(val));
  });
}
