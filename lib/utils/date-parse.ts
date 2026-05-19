/**
 * parseLocalDate — converts a "YYYY-MM-DD" string into a Date pinned at
 * local-noon. This avoids the classic off-by-one bug where calling
 * `new Date("2026-05-14")` is parsed as UTC midnight, which becomes the
 * previous calendar day in negative-UTC-offset locales.
 *
 * Behaviour:
 * - "YYYY-MM-DD" (date-only) → local noon Date on that calendar day
 * - "YYYY-MM-DDTHH:..." (ISO datetime) → unchanged native Date parse
 * - empty / invalid → new Date() (current moment) so callers that don't
 *   guard for null don't crash. If you need a null fallback, use
 *   `parseLocalDateOrNull` instead.
 */
export function parseLocalDate(s: string): Date {
  if (!s) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(y, mo - 1, d, 12, 0, 0, 0);
  }
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

export function parseLocalDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  }
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}
