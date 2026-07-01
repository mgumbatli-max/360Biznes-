import { NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db/prisma";

/**
 * Cron endpoint — vaxtı keçən kampaniyaları status="expired" et.
 * Hər saat və ya günlük çağırılır (vercel.json və ya külxana cron).
 *
 * Tenant-agnostik: birbaşa global SQL ilə işləyir.
 */
export async function GET(request: Request) {
  // 🔒 Fail-CLOSED (audit #4) — CRON_SECRET yoxdursa/yanlışdırsa rədd et.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const result = await prismaUnscoped.campaigns.updateMany({
      where: {
        status: { in: ["active", "paused"] },
        bitme: { lt: now, not: null },
      },
      data: { status: "expired", yenilendi: new Date() },
    });
    return NextResponse.json({ ok: true, expired: result.count, at: now.toISOString() });
  } catch (e) {
    console.error("[cron/expire-campaigns]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export const POST = GET;
