import { NextRequest, NextResponse } from "next/server";

// MÜVƏQQƏTİ — region uyğunlaşdırma diaqnostiki (webhook/v1 altında → middleware-siz).
// Yalnız region stringi qaytarır (kredensial YOX), token-qorumalı. Sonra silinəcək.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== "regiondiag-2026") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let host = process.env.PGHOST || process.env.PGHOST_UNPOOLED || "";
  if (!host) {
    try {
      const u = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "";
      host = u ? new URL(u).hostname : "";
    } catch { host = ""; }
  }
  const m = host.match(/\.([a-z]{2}-[a-z]+-\d)\.aws\.neon\.tech/i);
  return NextResponse.json({
    vercelRegion: process.env.VERCEL_REGION ?? null,
    neonRegion: m?.[1] ?? null,
    hostHint: host ? host.replace(/^[^.]+/, "ep-***") : null,
  });
}
