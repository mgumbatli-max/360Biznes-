import { NextRequest, NextResponse } from "next/server";

/**
 * MÜVƏQQƏTİ diaqnostik — Vercel funksiyasının region-unu Neon DB region-u ilə
 * uyğunlaşdırmaq üçün YALNIZ region/host-region stringini qaytarır (kredensial YOX).
 * Token ilə qorunur. Region öyrənildikdən sonra bu fayl SİLİNƏCƏK.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== "regiondiag-2026") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const host =
    process.env.PGHOST ||
    process.env.PGHOST_UNPOOLED ||
    (() => {
      try {
        const u = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "";
        return u ? new URL(u).hostname : "";
      } catch {
        return "";
      }
    })();
  // host: ep-xxx-123.<region>.aws.neon.tech → region tokenini çıxar
  const m = host.match(/\.([a-z]{2}-[a-z]+-\d)\.aws\.neon\.tech/i);
  const neonRegion = m?.[1] ?? null;
  return NextResponse.json({
    vercelRegion: process.env.VERCEL_REGION ?? null, // funksiyanın işlədiyi region
    neonRegion, // DB region (host-dan)
    hostHint: host ? host.replace(/^[^.]+/, "ep-***") : null, // kredensial yox, yalnız domen
  });
}
