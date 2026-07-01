import { NextResponse, type NextRequest } from "next/server";
import { runFinanceTriggersForAllTenants } from "@/features/maliyye/triggers";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Maliyə xəbərdarlıq triqqerləri — bütün tenant-larda.
 *
 * Hər aktiv sahibkar üçün:
 *  - Gecikmiş müştəri borcu (60+ gün) → bildiriş
 *  - 90+ gün → həm bildiriş, həm tapşırıq (idempotent)
 *  - Marketplace payout gecikir (donem_bitme + 14 gün, hələ ödənilməyib)
 *  - Kassa/bank balansı mənfi
 *
 * Hər gün səhər çalışdırılır. Vercel: vercel.json crons sahəsinə əlavə et.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`
 */
export async function GET(req: NextRequest) {
  // 🔒 Fail-CLOSED (audit #4) — CRON_SECRET yoxdursa/yanlışdırsa rədd et.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFinanceTriggersForAllTenants();
    return NextResponse.json({
      ok: true,
      tenants: result.tenants,
      stats: result.total,
    });
  } catch (e) {
    console.error("[cron/finance-triggers]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Xəta" },
      { status: 500 },
    );
  }
}
