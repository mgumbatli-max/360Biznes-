/**
 * Sadə in-memory sliding-window rate limiter.
 *
 * MƏHDUDIYYƏTLƏR:
 *  - Yalnız bir Node prosesi üçündür. Multi-instance Vercel-də hər instance ayrı sayğacla işləyir.
 *    Strict global limit lazımdırsa Redis/KV adapter-ı lazımdır. Çox kanallar üçün bu kifayət edir.
 *  - Yaddaşda lazımsız böyüməsin deyə hər çağırışda köhnə timestamp-ları çıxarırıq.
 */

const buckets = new Map<string, number[]>();

/**
 * Verilmiş key üçün son `windowMs` ms ərzində icazə verilən sorğu sayını yoxla.
 * Limit aşılıbsa false qaytarır.
 */
export function rateAllow(key: string, limit: number, windowMs: number = 60_000): boolean {
  if (limit <= 0) return true; // limit söndürülüb
  const now = Date.now();
  const cutoff = now - windowMs;
  const arr = buckets.get(key) ?? [];
  // Köhnələri ləğv et
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  const fresh = i > 0 ? arr.slice(i) : arr;
  if (fresh.length >= limit) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return true;
}

/** Qarşı tərəfə Retry-After saniyəsini qaytarmaq üçün — ən köhnə qeyd çıxana qədər. */
export function rateRetryAfterSec(key: string, windowMs: number = 60_000): number {
  const arr = buckets.get(key);
  if (!arr || arr.length === 0) return 0;
  const oldest = arr[0];
  return Math.max(1, Math.ceil((oldest + windowMs - Date.now()) / 1000));
}
