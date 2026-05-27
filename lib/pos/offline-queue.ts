/**
 * POS offline sales queue — localStorage əsaslı.
 *
 * Internet itəndə kassa satış action-ı server-ə getmir. Onun əvəzinə
 * payload-ı bu queue-ya yığırıq. Internet qayıtdıqda useOnlineStatus
 * hook drain edib server-ə göndərir.
 *
 * Notlar:
 *  - localStorage 5MB limit — orta bir satışda payload ~2KB, deməli
 *    ~2500 offline satış sığa bilər. Praktikada bir POS sessiyası bu
 *    qədər offline qalmayacaq.
 *  - Hər giriş öz `id`-si (timestamp + random) ilə işarələnir → idempotency
 *    server tərəfində yoxlanılır (gələcəkdə qarşılığı).
 */

const QUEUE_KEY = "pos-offline-queue-v1";

export type QueuedSale = {
  id: string;            // client-side unique id (idempotency key)
  payload: unknown;      // createSale arg-ı (typed in caller)
  createdAt: number;     // ms timestamp
  attempts: number;      // sync cəhd sayı
  lastError?: string;
};

function readQueue(): QueuedSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as QueuedSale[];
    return [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedSale[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (e) {
    // QuotaExceededError — ən qədim 50%-ni at, sonra yenidən cəhd
    if (items.length > 10) {
      const trimmed = items.slice(Math.floor(items.length / 2));
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed)); } catch {
        /* hələ də olmursa, log */
        console.error("[pos-offline-queue] storage full, dropping", e);
      }
    }
  }
}

export function enqueueSale(payload: unknown): QueuedSale {
  const item: QueuedSale = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  const q = readQueue();
  q.push(item);
  writeQueue(q);
  return item;
}

export function getQueue(): QueuedSale[] {
  return readQueue();
}

export function getQueueSize(): number {
  return readQueue().length;
}

export function removeFromQueue(id: string): void {
  const q = readQueue().filter((it) => it.id !== id);
  writeQueue(q);
}

export function markAttempt(id: string, error?: string): void {
  const q = readQueue();
  const idx = q.findIndex((it) => it.id === id);
  if (idx >= 0) {
    q[idx].attempts++;
    if (error) q[idx].lastError = error;
    writeQueue(q);
  }
}

export function clearQueue(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(QUEUE_KEY); } catch { /* silent */ }
}
