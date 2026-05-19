import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { expireOldQuotes } from "@/features/ticaret/teklif-bron-actions";

export const dynamic = "force-dynamic";

/**
 * Manual cron endpoint: mark expired quotes as `vaxti_bitdi`, release
 * their reservations. Authenticated session required (tenant-scoped).
 * Can also be hit by an external scheduler with X-Cron-Secret header.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");

  // Allow either: authenticated user, or matching cron secret.
  if (cronSecret && headerSecret === cronSecret) {
    // Bypass auth for scheduler. Caller must specify sahibkar via query
    // — but for simplicity here we just refuse non-auth scheduler hits
    // until multi-tenant batch is implemented.
    return NextResponse.json(
      { ok: false, error: "Cron secret receive (per-tenant batch not implemented yet)" },
      { status: 501 }
    );
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const r = await expireOldQuotes();
  if (!r.ok) return NextResponse.json(r, { status: 500 });
  return NextResponse.json(r);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST this endpoint to expire old quotes for the authenticated tenant.",
  });
}
