import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const MAX_RETRY_COUNT = 5;
const BACKOFF_MIN_MULT = 2; // hər failureda growth factor

/**
 * Audit log outbox retry — pending sətirlərdə audit_log.create-i təkrar cəhd edir.
 *
 * Çağırılma:
 *   - Vercel Cron: vercel.json-da hər 15 dəq tetiklenir
 *   - Manual: POST + X-Cron-Secret header
 *
 * Strategy:
 *   - status='pending' AND next_retry_at <= NOW() → batch (limit 100)
 *   - Hər biri üçün audit_log.create cəhd; uğursuz olarsa retry_count++,
 *     next_retry_at = NOW() + retry_count * 5 dəq exponential-like
 *   - retry_count >= MAX → status='abandoned' (manual müdaxilə tələb olunur)
 */
export async function POST(req: NextRequest) {
  // Vercel Cron Authorization: Bearer <CRON_SECRET>
  // Manual: X-Cron-Secret header
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  const okAuth =
    cronSecret &&
    (headerSecret === cronSecret || auth === `Bearer ${cronSecret}`);
  if (!okAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let abandoned = 0;

  // Eyni anda max 100 sətir götürürük (qalanı növbəti dövrü gözləyəcək)
  const pending = await prismaUnscoped.audit_log_outbox.findMany({
    where: { status: "pending", next_retry_at: { lte: new Date() } },
    take: 100,
    orderBy: { yaradildi: "asc" },
  });

  for (const row of pending) {
    processed++;
    try {
      const payload = row.payload as Prisma.JsonObject;
      await prismaUnscoped.audit_log.create({
        data: payload as Prisma.audit_logUncheckedCreateInput,
      });
      await prismaUnscoped.audit_log_outbox.update({
        where: { id: row.id },
        data: { status: "success", yenilendi: new Date() },
      });
      succeeded++;
    } catch (e) {
      const newCount = row.retry_count + 1;
      const errMsg = e instanceof Error ? e.message : String(e);

      if (newCount >= MAX_RETRY_COUNT) {
        await prismaUnscoped.audit_log_outbox.update({
          where: { id: row.id },
          data: {
            status: "abandoned",
            retry_count: newCount,
            error_message: errMsg,
            yenilendi: new Date(),
          },
        });
        abandoned++;
      } else {
        // Exponential backoff: 5 min × retry_count^2 (5, 20, 45, 80 dəq...)
        const backoffMin = 5 * Math.pow(newCount, BACKOFF_MIN_MULT - 1);
        const nextRetry = new Date(Date.now() + backoffMin * 60_000);
        await prismaUnscoped.audit_log_outbox.update({
          where: { id: row.id },
          data: {
            retry_count: newCount,
            error_message: errMsg,
            next_retry_at: nextRetry,
            yenilendi: new Date(),
          },
        });
        failed++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    succeeded,
    failed,
    abandoned,
  });
}

// GET handler — sadəcə status göstərmək üçün (yalnız cron secret ilə)
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const [pendingCount, abandonedCount] = await Promise.all([
    prismaUnscoped.audit_log_outbox.count({ where: { status: "pending" } }),
    prismaUnscoped.audit_log_outbox.count({ where: { status: "abandoned" } }),
  ]);
  return NextResponse.json({ ok: true, pendingCount, abandonedCount });
}
