import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const QRUP = "outbound_retry_queue";
const MAX_ATTEMPTS = 3;
const QUEUE_MAX = 100;

export type RetryEntry = {
  id: string;                 // unikal — `<kanal>:<ts>:<rand>`
  enqueued_at: string;        // ISO
  last_attempt_at: string | null;
  attempts: number;           // 0..MAX_ATTEMPTS
  next_retry_at: string;      // ISO — bu vaxtdan sonra yenidən cəhd edilə bilər
  last_error: string | null;
  /** Original payload — push edilən body. Yenidən cəhddə eyni body göndərilir. */
  body: string;
  /** Outbound URL snapshot — kanal URL-i sonradan dəyişsə də saxlanılır. */
  url: string;
  /** Sayğac kimi: bu push neçə item göndərirdi. */
  item_count: number;
};

export type RetryQueue = {
  entries: RetryEntry[];
};

const EMPTY: RetryQueue = { entries: [] };

function backoffSeconds(attempt: number): number {
  // 1s × 2^attempt: 1, 2, 4, 8, 16... clamp 5 dəq
  return Math.min(300, Math.pow(2, attempt));
}

export async function getRetryQueue(sahibkarId: string, kanal: string): Promise<RetryQueue> {
  const row = await prisma.ayarlar.findUnique({
    where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: kanal } },
    select: { deyer: true },
  });
  if (!row?.deyer) return { ...EMPTY };
  try {
    const p = JSON.parse(row.deyer) as Partial<RetryQueue>;
    return { entries: Array.isArray(p.entries) ? p.entries : [] };
  } catch {
    return { ...EMPTY };
  }
}

async function saveQueue(sahibkarId: string, kanal: string, queue: RetryQueue): Promise<void> {
  const payload = JSON.stringify({ entries: queue.entries.slice(0, QUEUE_MAX) });
  await prisma.ayarlar.upsert({
    where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: kanal } },
    create: { sahibkar_id: sahibkarId, qrup: QRUP, acar: kanal, deyer: payload, nov: "string" },
    update: { deyer: payload, yenilendi: new Date() },
  });
}

/** Push uğursuz olduqda queue-ya əlavə et. */
export async function enqueueOutboundRetry(opts: {
  sahibkarId: string;
  kanal: string;
  url: string;
  body: string;
  itemCount: number;
  error: string;
}): Promise<void> {
  try {
    const q = await getRetryQueue(opts.sahibkarId, opts.kanal);
    const now = new Date();
    const next = new Date(now.getTime() + backoffSeconds(1) * 1000);
    q.entries.unshift({
      id: `${opts.kanal}:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`,
      enqueued_at: now.toISOString(),
      last_attempt_at: now.toISOString(),
      attempts: 1, // ilk uğursuz push attempt 1 sayılır
      next_retry_at: next.toISOString(),
      last_error: opts.error,
      body: opts.body,
      url: opts.url,
      item_count: opts.itemCount,
    });
    await saveQueue(opts.sahibkarId, opts.kanal, q);
  } catch (e) {
    console.error("[enqueueOutboundRetry]", e);
  }
}

export async function getAllRetryQueues(): Promise<Record<string, RetryQueue>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: QRUP },
      select: { acar: true, deyer: true },
    });
    const out: Record<string, RetryQueue> = {};
    for (const r of rows) {
      try {
        const p = JSON.parse(r.deyer ?? "{}") as Partial<RetryQueue>;
        out[r.acar] = { entries: Array.isArray(p.entries) ? p.entries : [] };
      } catch {}
    }
    return out;
  });
}

/** Action API üçün — queue-dan bir entry-ni sil. */
export async function removeRetryEntry(sahibkarId: string, kanal: string, entryId: string): Promise<void> {
  const q = await getRetryQueue(sahibkarId, kanal);
  q.entries = q.entries.filter((e) => e.id !== entryId);
  await saveQueue(sahibkarId, kanal, q);
}

/** Action API üçün — entry yenidən cəhddən sonra yenilə (uğursuz olarsa). */
export async function bumpRetryEntry(
  sahibkarId: string,
  kanal: string,
  entryId: string,
  error: string,
): Promise<{ exhausted: boolean }> {
  const q = await getRetryQueue(sahibkarId, kanal);
  const idx = q.entries.findIndex((e) => e.id === entryId);
  if (idx === -1) return { exhausted: true };
  const e = q.entries[idx];
  const nextAttempts = e.attempts + 1;
  if (nextAttempts >= MAX_ATTEMPTS) {
    // Maks cəhd ötdü — queue-dan çıxarırıq, audit qalır
    q.entries.splice(idx, 1);
    await saveQueue(sahibkarId, kanal, q);
    return { exhausted: true };
  }
  const now = new Date();
  const next = new Date(now.getTime() + backoffSeconds(nextAttempts) * 1000);
  q.entries[idx] = {
    ...e,
    attempts: nextAttempts,
    last_attempt_at: now.toISOString(),
    next_retry_at: next.toISOString(),
    last_error: error,
  };
  await saveQueue(sahibkarId, kanal, q);
  return { exhausted: false };
}
