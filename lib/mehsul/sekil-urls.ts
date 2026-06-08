/**
 * Çoxlu məhsul şəkli — `mehsullar.sekil_url` field-i daxilində.
 *
 * Format: URL-lər `|` (pipe) ayrıcısı ilə birləşdirilir.
 *   "https://.../1.jpg|https://.../2.jpg|https://.../3.jpg"
 *
 * İlk URL "əsas şəkil" sayılır — POS-da, siyahıda, marketplace-də göstərilir.
 * Qalanları gallery / detail səhifəsində göstərilir.
 *
 * Migration tələb etmir — mövcud sekil_url field-i String? və TEXT tipidir,
 * uzunluq limiti yoxdur.
 */

const SEPARATOR = "|";
// 3 əsas + 2 ehtiyat — POS, marketplace və detail view üçün məntiqli üst sərhəd.
const MAX_URLS = 5;

export function parseSekilUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_URLS);
}

export function joinSekilUrls(urls: string[]): string {
  return urls
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .slice(0, MAX_URLS)
    .join(SEPARATOR);
}

/** Əsas şəkil (POS, siyahı, marketplace üçün) — ilk URL. */
export function primarySekilUrl(raw: string | null | undefined): string | null {
  const urls = parseSekilUrls(raw);
  return urls[0] ?? null;
}

/** Gallery üçün ikinci və sonrakı şəkillər. */
export function secondarySekilUrls(raw: string | null | undefined): string[] {
  return parseSekilUrls(raw).slice(1);
}

/** Şəkil sayı — UI badge üçün. */
export function sekilCount(raw: string | null | undefined): number {
  return parseSekilUrls(raw).length;
}

export const MAX_SEKIL_URLS = MAX_URLS;
