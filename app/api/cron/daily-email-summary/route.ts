import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { buildDailySummary, renderDailySummaryHtml } from "@/features/email/daily-summary";
import { sendEmail, isEmailRealMode } from "@/lib/email/adapter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Vercel Cron — hər səhər saat 8:00 (UTC: 04:00) günlük xülasə email-i göndərir.
 *
 * Schedule: `0 4 * * *` (vercel.json) — UTC, Azərbaycan vaxtı ilə 08:00
 * Auth: CRON_SECRET (Vercel cron header)
 *
 * Bütün sahibkar üzrə:
 *  - email_notification config oxu
 *  - `daily_summary` event seçilibsə
 *  - dünənki məlumatı hesabla, HTML email render et, göndər
 */
export async function GET(req: NextRequest) {
  // 🔒 Fail-CLOSED (audit #4) — CRON_SECRET yoxdursa/yanlışdırsa rədd et.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailRealMode()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Email provider env-də qoyulmayıb (RESEND_API_KEY / SENDGRID_API_KEY)",
    });
  }

  const startedAt = Date.now();

  const rows = await prisma.ayarlar.findMany({
    where: { qrup: "email_notification" },
    select: { sahibkar_id: true, deyer: true },
  });

  const targets: Array<{ sahibkar_id: string; recipient: string }> = [];
  for (const r of rows) {
    try {
      const p = JSON.parse(r.deyer ?? "{}") as { recipient?: string; events?: string[] };
      if (p.recipient && p.events?.includes("daily_summary")) {
        targets.push({ sahibkar_id: r.sahibkar_id, recipient: p.recipient });
      }
    } catch {}
  }

  const results: Array<{ sahibkar_id: string; recipient: string; ok: boolean; error?: string }> = [];

  for (const t of targets) {
    try {
      const summary = await buildDailySummary(t.sahibkar_id);
      const { subject, html } = renderDailySummaryHtml(summary);
      const res = await sendEmail({ to: t.recipient, subject, html });
      results.push({
        sahibkar_id: t.sahibkar_id,
        recipient: t.recipient,
        ok: res.ok,
        error: res.ok ? undefined : res.error,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[daily-email-summary]", t.sahibkar_id, msg);
      results.push({ sahibkar_id: t.sahibkar_id, recipient: t.recipient, ok: false, error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - startedAt,
    targets: targets.length,
    success: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    results,
  });
}
