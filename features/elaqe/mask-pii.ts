import "server-only";

/**
 * Müştəri/kontragent həssas PII (telefon/email/ünvan) maskalanması.
 * «musteri.gizli» icazəsi olmayan (və sahibkar/admin/owner olmayan) istifadəçilər
 * üçün SERVER-də maskalanır — client gating kifayət deyil (mobil API/DOM bypass).
 */

export function canSeeContactPII(rolAd?: string | null, icazeler?: string[]): boolean {
  const r = (rolAd ?? "").toLowerCase();
  if (r.includes("sahibkar") || r.includes("admin") || r.includes("owner")) return true;
  return (icazeler ?? []).includes("musteri.gizli");
}

function maskPhone(v?: string | null): string | null {
  if (!v) return v ?? null;
  const s = String(v).trim();
  return s.length <= 4 ? "•••" : "••• " + s.slice(-4);
}

function maskEmail(v?: string | null): string | null {
  if (!v) return v ?? null;
  const s = String(v);
  const at = s.indexOf("@");
  if (at < 0) return "•••";
  return `${s.slice(0, 1)}•••@•••`;
}

/** PII sahələrini icazə yoxdursa maskala (obyekti in-place mutasiya edir). */
export function maskContactPII<T>(row: T | null, canSee: boolean): T | null {
  if (!row || canSee) return row;
  const r = row as Record<string, unknown>;
  if ("telefon" in r) r.telefon = maskPhone(r.telefon as string | null);
  if ("telefon2" in r) r.telefon2 = maskPhone(r.telefon2 as string | null);
  if ("email" in r) r.email = maskEmail(r.email as string | null);
  if ("unvan" in r) r.unvan = r.unvan ? "•••" : (r.unvan ?? null);
  return row;
}
