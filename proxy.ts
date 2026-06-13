// Next.js 16+ renamed `middleware` to `proxy`. NextAuth v5-də mövcud
// canonical pattern: `auth()`-i callback ilə wrap et — callback `NextResponse`-ə
// header inject edə bilər. Bu yolla auth gating saxlanır VƏ x-pathname header
// inject olunur (layout-da route-based icazə yoxlaması üçün).

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Cron endpoint-ləri YALNIZ CRON_SECRET ilə işləsin (fail-closed). Vercel cron
  // `Authorization: Bearer <CRON_SECRET>` göndərir — env-də CRON_SECRET MÜTLƏQ
  // qoyulmalıdır. Əvvəl route-lar `if(secret)` idi → CRON_SECRET yoxdursa AÇIQ
  // idi (istənilən kəs trigger edə bilirdi). İndi bir yerdən qapalı saxlanır.
  if (pathname.startsWith("/api/cron/")) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Qlobal Lite/Pro rejimi — cookie yoxdursa cihaza görə ilkin təyin et:
  // mobil (telefon/tablet) → lite (sadə, sürətli), masaüstü → pro (tam).
  // Bundan sonra həm server (getAppMode), həm client eyni cookie-ni oxuyur.
  if (!req.cookies.get("app-mode")) {
    const ua = req.headers.get("user-agent") ?? "";
    const mode = /Mobile|Android|iPhone|iPad|iPod|Mobi/i.test(ua) ? "lite" : "pro";
    res.cookies.set("app-mode", mode, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return res;
});

export const config = {
  // Exclude all static asset paths — proxy must NEVER run for images, fonts,
  // PWA manifest, robots, or sitemap. Each invocation re-runs auth() and
  // adds tens of ms on the critical path.
  matcher: [
    "/((?!api/auth|api/webhook/v1|_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|wasm|assets|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|eot|map|wasm)$).*)",
  ],
};
