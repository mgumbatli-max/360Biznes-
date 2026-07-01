import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";
import { pushStockToChannel } from "@/features/qiymet-kanal/outbound-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5 dəq — çoxlu məhsullu sahibkarlar üçün

/**
 * Vercel Cron — saatlıq tam sync.
 *
 * Niyə lazımdır? Delta push (POS sale-dən sonra avtomatik) kanal-ları canlı saxlayır,
 * lakin nə vaxtsa bir push itə bilər (retry queue exhausted, platform 502 24 saat və s.).
 * Saatlıq tam sync reliability rezervidir — bütün məhsulların stoku + qiyməti
 * yenidən göndərilir, kanal və ERP-də 100% uyğunluq qarantilənir.
 *
 * Schedule: hər saat 00 dəqiqədə (vercel.json)
 * Şərt: kanal-da `outbound_url` + `auto_push_on_sale: true` olmalıdır
 *       (yalnız "tam avto" qoşulmuş kanal-lara — manual rejimdə olan kanal-lar toxunulmur)
 *
 * Auth: CRON_SECRET env (Vercel cron header)
 */
export async function GET(req: NextRequest) {
  // 🔒 Fail-CLOSED (audit #4): əvvəl `if(secret){...}` idi — CRON_SECRET təyin
  // edilməsə auth tamamilə atlanıb endpoint anonim açıq olurdu (bütün tenant-ları
  // gəzib outbound push tetiklyir). İndi secret yoxdursa 500, yanlışdırsa 401.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server konfiqurasiya xətası (CRON_SECRET yox)" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  // Bütün sahibkarlar üzrə kanal_extra-da auto_push_on_sale=true olanları tap
  const rows = await prisma.ayarlar.findMany({
    where: { qrup: "kanal_extra" },
    select: { sahibkar_id: true, acar: true, deyer: true },
  });

  const targets: Array<{ sahibkar_id: string; kanal: string }> = [];
  for (const r of rows) {
    try {
      const p = JSON.parse(r.deyer ?? "{}") as {
        auto_push_on_sale?: boolean;
        outbound_url?: string | null;
      };
      if (p.auto_push_on_sale && p.outbound_url) {
        targets.push({ sahibkar_id: r.sahibkar_id, kanal: r.acar });
      }
    } catch {}
  }

  const results: Array<{
    sahibkar_id: string;
    kanal: string;
    ok: boolean;
    sent?: number;
    status?: number;
    ms?: number;
    error?: string;
  }> = [];

  for (const t of targets) {
    const r = await runWithTenant(
      {
        sahibkarId: t.sahibkar_id,
        istifadeciId: "00000000-0000-0000-0000-000000000000",
        rolId: 0,
        icazeler: [],
      },
      () => pushStockToChannel({ kanal: t.kanal }),
    );
    if (r.ok) {
      results.push({
        sahibkar_id: t.sahibkar_id,
        kanal: t.kanal,
        ok: true,
        sent: r.data?.sent,
        status: r.data?.status,
        ms: r.data?.ms,
      });
    } else {
      results.push({
        sahibkar_id: t.sahibkar_id,
        kanal: t.kanal,
        ok: false,
        error: r.error,
      });
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
