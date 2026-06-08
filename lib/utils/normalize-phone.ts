/**
 * Telefon nömrəsini deduplikasiya/axtarış üçün normallaşdırır.
 *
 * - Boşluq, defis, mötərizə, nöqtə silinir
 * - "+" işarəsi qorunur (ölkə kodu)
 * - Azərbaycan əsas formatlar üçün eyni göstəriyə gəlir:
 *     "+994 50 123 45 67" → "994501234567"
 *     "994(50)1234567"    → "994501234567"
 *     "050 123 45 67"     → "994501234567"  (yerli → beynəlxalq)
 *     "0501234567"        → "994501234567"
 *
 * Yalnız axtarış/dedupe üçündür — DB-də əsl yazılış qorunur.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw).trim();
  if (!s) return "";

  // Hər şeyi at, yalnız rəqəm + leading + qalsın
  const hasPlus = s.startsWith("+");
  s = s.replace(/[^\d]/g, "");
  if (!s) return "";

  // 8 ilə başlayanlar — köhnə Azərbaycan format (8XXXXXXXXX) → 994
  if (s.length === 10 && s.startsWith("0")) {
    // Yerli format "050xxxxxxx" → "994 50 xxxxxxx"
    s = "994" + s.slice(1);
  } else if (s.length === 9 && /^[57]\d/.test(s.slice(0, 2))) {
    // "501234567" → "994501234567"
    s = "994" + s;
  } else if (hasPlus) {
    // "+994..." artıq düzgün formatdır, prefix qoruyuruq
  }
  return s;
}

/**
 * İki telefon nömrəsini normallaşdırılmış formada müqayisə edir.
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na === nb;
}
