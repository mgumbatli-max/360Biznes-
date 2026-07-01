import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";
import { getKanalExtraServer } from "@/features/qiymet-kanal/kanal-extra";
import {
  getRetryQueue,
  removeRetryEntry,
  bumpRetryEntry,
} from "@/features/qiymet-kanal/outbound-retry";
import { recordOutboundPush } from "@/features/qiymet-kanal/outbound-stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel cron tipik olaraq 10s timeout-a uyğun gəlir (hobby plan)
export const maxDuration = 60;

/**
 * Vercel Cron — bütün sahibkarların retry queue-larını avtomatik işlədir.
 *
 * Schedule: hər 1 dəqiqə (vercel.json-da konfiqurasiya olunur)
 * Auth: Vercel cron `Authorization: Bearer <CRON_SECRET>` header göndərir.
 *       CRON_SECRET env-də qoyulmalıdır.
 *
 * Davranış:
 *  - ayarlar cədvəlindən bütün outbound_retry_queue qrupları oxu
 *  - hər sahibkar × kanal cütü üçün ready entry-ləri işlət
 *  - exponential backoff respektlə alın
 *  - 3 cəhddən sonra entry queue-dan çıxır
 *
 * Manual çağırış üçün də işləyir (devops debug) — header şərt deyil, env-də CRON_SECRET qoyulubsa.
 */
export async function GET(req: NextRequest) {
  // 🔒 Fail-CLOSED (audit #4) — CRON_SECRET yoxdursa/yanlışdırsa rədd et.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const groups = await prisma.ayarlar.findMany({
    where: { qrup: "outbound_retry_queue" },
    select: { sahibkar_id: true, acar: true, deyer: true },
  });

  let totalEntries = 0;
  let totalProcessed = 0;
  let totalOk = 0;
  let totalFail = 0;
  const perKanal: Array<{ sahibkar_id: string; kanal: string; processed: number; ok: number; fail: number; skipped: number }> = [];

  for (const g of groups) {
    const sahibkarId = g.sahibkar_id;
    const kanal = g.acar;
    // Tenant context bağla — getKanalExtraServer/recordOutboundPush bunu tələb edə bilər
    const result = await runWithTenant(
      {
        sahibkarId,
        istifadeciId: "00000000-0000-0000-0000-000000000000",
        rolId: 0,
        icazeler: [],
      },
      async () => {
        const extra = await getKanalExtraServer(sahibkarId, kanal);
        const queue = await getRetryQueue(sahibkarId, kanal);
        if (queue.entries.length === 0 || !extra.outbound_url) {
          return { processed: 0, ok: 0, fail: 0, skipped: 0 };
        }
        const now = Date.now();
        let ok = 0;
        let fail = 0;
        let skipped = 0;
        let processed = 0;

        const snapshot = [...queue.entries];
        for (const entry of snapshot) {
          if (new Date(entry.next_retry_at).getTime() > now) {
            skipped++;
            continue;
          }
          processed++;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (extra.outbound_secret) {
            const sig = createHmac("sha256", extra.outbound_secret).update(entry.body).digest("hex");
            headers["X-Signature"] = `sha256=${sig}`;
          }
          const t0 = Date.now();
          try {
            const res = await fetch(entry.url, {
              method: "POST",
              headers,
              body: entry.body,
              signal: AbortSignal.timeout(30_000),
            });
            const ms = Date.now() - t0;
            const errBody = res.ok ? null : await res.text().catch(() => null);
            await recordOutboundPush({
              sahibkarId,
              kanal,
              status: res.status,
              sent: entry.item_count,
              ms,
              error: res.ok ? null : (errBody?.slice(0, 200) ?? `HTTP ${res.status}`),
            });
            if (res.ok) {
              await removeRetryEntry(sahibkarId, kanal, entry.id);
              ok++;
            } else {
              await bumpRetryEntry(sahibkarId, kanal, entry.id, `HTTP ${res.status}`);
              fail++;
            }
          } catch (e) {
            const ms = Date.now() - t0;
            const msg = e instanceof Error ? e.message : String(e);
            await recordOutboundPush({
              sahibkarId,
              kanal,
              status: 0,
              sent: entry.item_count,
              ms,
              error: msg.slice(0, 200),
            });
            await bumpRetryEntry(sahibkarId, kanal, entry.id, msg.slice(0, 200));
            fail++;
          }
        }
        return { processed, ok, fail, skipped };
      },
    );

    perKanal.push({ sahibkar_id: sahibkarId, kanal, ...result });
    totalProcessed += result.processed;
    totalOk += result.ok;
    totalFail += result.fail;
    totalEntries += result.processed + result.skipped;
  }

  const ms = Date.now() - startedAt;
  return NextResponse.json({
    ok: true,
    duration_ms: ms,
    groups: groups.length,
    total_entries_seen: totalEntries,
    total_processed: totalProcessed,
    total_ok: totalOk,
    total_fail: totalFail,
    per_kanal: perKanal,
  });
}
